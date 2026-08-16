import { useEffect } from "react";
import { useRouter } from "next/router";

export default function LegacyCaseRedirect() {
  const router = useRouter();
  useEffect(() => {
    const id = router.query.id;
    if (id) router.replace(`/?case=${id}`);
    else router.replace("/cases");
  }, [router, router.query.id]);
  return null;
}
