import { useEffect } from "react";
import { useRouter } from "next/router";

export default function LegacyUploadRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/cases");
  }, [router]);
  return null;
}
