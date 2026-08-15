import { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";

/** Scrolls to top on every route change */
export default function ScrollToTop() {
  const { key } = useLocation();

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [key]);

  return null;
}
