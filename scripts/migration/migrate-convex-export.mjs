#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import {
  applicationDefault,
  cert,
  getApp,
  getApps,
  initializeApp,
} from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

import {
  APPLICATION_TABLES,
  loadConvexExport,
  filterUnownedBusinesses,
  migrationManifest,
  transformConvexExport,
  validateConvexExport,
} from "./convex-export.mjs";

function parseArguments(argv) {
  const options = { apply: false, overwriteExisting: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--apply") options.apply = true;
    else if (value === "--overwrite-existing") options.overwriteExisting = true;
    else if (value === "--source") options.source = argv[++index];
    else if (value === "--project") options.project = argv[++index];
    else if (value === "--bucket") options.bucket = argv[++index];
    else throw new Error(`Unknown argument: ${value}`);
  }
  if (!options.source) throw new Error("--source <Convex export directory> is required.");
  return options;
}

function printReport(label, value) {
  process.stdout.write(`${label}: ${JSON.stringify(value, null, 2)}\n`);
}

async function fileSha256(filePath) {
  const content = await readFile(filePath);
  return createHash("sha256").update(content).digest("hex");
}

function getFirebaseAdminClients(projectId, bucketName) {
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const isEmulator = Boolean(
    process.env.FIREBASE_AUTH_EMULATOR_HOST ||
      process.env.FIRESTORE_EMULATOR_HOST ||
      process.env.FIREBASE_STORAGE_EMULATOR_HOST,
  );
  const credential = clientEmail && privateKey
    ? cert({ projectId, clientEmail, privateKey })
    : isEmulator
      ? undefined
      : applicationDefault();
  const app = getApps().length
    ? getApp()
    : initializeApp({
        ...(credential ? { credential } : {}),
        projectId,
        storageBucket: bucketName,
      });
  return {
    firestore: getFirestore(app),
    storage: getStorage(app),
  };
}

async function applyStorage(bucket, plan, overwriteExisting) {
  let created = 0;
  let overwritten = 0;
  let skipped = 0;
  const hasPublicObjects = [...plan.values()].some(
    (entry) => entry.visibility === "public",
  );
  if (hasPublicObjects) {
    const [bucketMetadata] = await bucket.getMetadata();
    if (bucketMetadata.iamConfiguration?.uniformBucketLevelAccess?.enabled) {
      throw new Error(
        "Public migrated files require object-level ACLs, but this bucket has uniform bucket-level access enabled. Disable uniform bucket-level access or choose a CDN proxy/managed-folder access model before applying the migration.",
      );
    }
  }
  for (const [sourceId, entry] of plan) {
    const file = bucket.file(entry.objectPath);
    let existing = null;
    try {
      [existing] = await file.getMetadata();
    } catch (error) {
      if (Number(error?.code) !== 404) throw error;
    }
    const sourceFileChecksum = await fileSha256(entry.sourceFile);
    const matches =
      existing?.metadata?.convexStorageId === sourceId &&
      existing?.metadata?.sourceFileChecksum === sourceFileChecksum;
    if (matches) {
      if (entry.visibility === "public") await file.makePublic();
      skipped += 1;
      continue;
    }
    if (existing && !overwriteExisting) {
      throw new Error(
        `Storage target ${entry.objectPath} already exists with different migration metadata.`,
      );
    }
    if (!existing || overwriteExisting) {
      await bucket.upload(entry.sourceFile, {
        destination: entry.objectPath,
        metadata: {
          contentType: entry.contentType,
          metadata: {
            convexStorageId: sourceId,
            ...(entry.visibility === "private"
              ? { firebaseStorageDownloadTokens: entry.token }
              : {}),
            sourceFileChecksum,
          },
        },
        resumable: false,
      });
      if (existing) overwritten += 1;
      else created += 1;
    }
    if (entry.visibility === "public") await file.makePublic();
  }
  return {
    created,
    overwritten,
    skipped,
    publicised: [...plan.values()].filter(
      (entry) => entry.visibility === "public",
    ).length,
  };
}

async function applyFirestore(firestore, tables, overwriteExisting) {
  let created = 0;
  let overwritten = 0;
  let skipped = 0;
  for (const table of APPLICATION_TABLES) {
    const documents = tables[table];
    for (let offset = 0; offset < documents.length; offset += 400) {
      const batch = documents.slice(offset, offset + 400);
      const refs = batch.map((document) =>
        firestore.collection(table).doc(document._id),
      );
      const existing = await firestore.getAll(...refs);
      const writer = firestore.bulkWriter();
      for (let index = 0; index < batch.length; index += 1) {
        const document = batch[index];
        const current = existing[index];
        const currentMigration = current.data()?._migration;
        const matches =
          current.exists &&
          currentMigration?.source === "convex" &&
          currentMigration?.sourceId === document._id &&
          currentMigration?.checksum === document._migration.checksum;
        if (matches) {
          skipped += 1;
          continue;
        }
        if (current.exists && !overwriteExisting) {
          throw new Error(
            `${table}/${document._id} already exists with different data.`,
          );
        }
        writer.set(current.ref, document);
        if (current.exists) overwritten += 1;
        else created += 1;
      }
      await writer.close();
    }
  }
  return { created, overwritten, skipped };
}

async function verifyStorage(bucket, plan) {
  const errors = [];
  for (const [sourceId, entry] of plan) {
    try {
      const [metadata] = await bucket.file(entry.objectPath).getMetadata();
      const expectedChecksum = await fileSha256(entry.sourceFile);
      if (
        metadata.metadata?.convexStorageId !== sourceId ||
        metadata.metadata?.sourceFileChecksum !== expectedChecksum
      ) {
        errors.push(entry.objectPath);
      }
      if (entry.visibility === "public") {
        const [acl] = await bucket.file(entry.objectPath).acl.get();
        if (!acl.some((grant) => grant.entity === "allUsers" && grant.role === "READER")) {
          errors.push(`${entry.objectPath}:public-access`);
        }
      }
    } catch {
      errors.push(entry.objectPath);
    }
  }
  return { checked: plan.size, errors };
}

async function verifyFirestore(firestore, tables) {
  const errors = [];
  let checked = 0;
  for (const table of APPLICATION_TABLES) {
    const documents = tables[table];
    for (let offset = 0; offset < documents.length; offset += 400) {
      const batch = documents.slice(offset, offset + 400);
      const snapshots = await firestore.getAll(
        ...batch.map((document) =>
          firestore.collection(table).doc(document._id),
        ),
      );
      snapshots.forEach((snapshot, index) => {
        checked += 1;
        if (
          !snapshot.exists ||
          snapshot.data()?._migration?.checksum !==
            batch[index]._migration.checksum
        ) {
          errors.push(`${table}/${batch[index]._id}`);
        }
      });
    }
  }
  return { checked, errors };
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const source = path.resolve(options.source);
  const loadedSnapshot = await loadConvexExport(source);
  const filtered = filterUnownedBusinesses(loadedSnapshot);
  const snapshot = filtered.snapshot;
  if (filtered.excludedBusinesses.length) {
    printReport("excludedUnownedBusinesses", {
      count: filtered.excludedBusinesses.length,
      businesses: filtered.excludedBusinesses.map((business) => ({
        id: business._id,
        name: business.name ?? null,
        ownerId: business.ownerId ?? null,
      })),
      storageObjects: filtered.excludedStorageCount,
    });
  }
  const validation = validateConvexExport(snapshot);
  printReport("validation", validation);
  if (validation.errors.length) {
    throw new Error(`Convex export validation failed with ${validation.errors.length} error(s).`);
  }

  const bucketName =
    options.bucket ??
    process.env.FIREBASE_STORAGE_BUCKET ??
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ??
    "dry-run.appspot.com";
  const tokenSecret = process.env.MIGRATION_STORAGE_TOKEN_SECRET ?? "";
  if (options.apply && tokenSecret.length < 32) {
    throw new Error(
      "MIGRATION_STORAGE_TOKEN_SECRET must contain at least 32 characters for --apply.",
    );
  }
  const transformed = transformConvexExport(snapshot, {
    bucket: bucketName,
    tokenSecret,
  });
  printReport("manifest", migrationManifest(snapshot, transformed));
  if (!options.apply) {
    process.stdout.write("Dry run complete. No Firebase data was changed.\n");
    return;
  }

  process.env.FIREBASE_PROJECT_ID =
    options.project ?? process.env.FIREBASE_PROJECT_ID;
  process.env.FIREBASE_STORAGE_BUCKET = bucketName;
  const { firestore, storage } = getFirebaseAdminClients(
    process.env.FIREBASE_PROJECT_ID,
    bucketName,
  );
  const storageResult = await applyStorage(
    storage.bucket(),
    transformed.storagePlan,
    options.overwriteExisting,
  );
  const firestoreResult = await applyFirestore(
    firestore,
    transformed.tables,
    options.overwriteExisting,
  );
  printReport("applied", { firestore: firestoreResult, storage: storageResult });
  const [firestoreVerification, storageVerification] = await Promise.all([
    verifyFirestore(firestore, transformed.tables),
    verifyStorage(storage.bucket(), transformed.storagePlan),
  ]);
  printReport("verification", {
    firestore: firestoreVerification,
    storage: storageVerification,
  });
  if (
    firestoreVerification.errors.length ||
    storageVerification.errors.length
  ) {
    throw new Error("Post-migration Firebase verification failed.");
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : error}\n`);
  process.exitCode = 1;
});
