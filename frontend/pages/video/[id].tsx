import { useEffect } from "react";
import { useRouter } from "next/router";

export default function LegacyVideoRedirect() {
  const router = useRouter();
  useEffect(() => {
    const id = router.query.id;
    if (id) router.replace(`/?clip=${id}`);
    else router.replace("/");
  }, [router, router.query.id]);
  return null;
}
