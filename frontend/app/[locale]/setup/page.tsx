"use client";

import {useEffect} from "react";
import {useRouter} from "next/navigation";
import {useAuth} from "@/hooks/useAuth";
import {USER_ROLES} from "@/const/modelConfig";

export default function SetupPage() {
  const router = useRouter();
  const { user, isLoading: userLoading } = useAuth();

  useEffect(() => {
    if (!userLoading && user) {
      // Redirect based on user role
      if (user.role === USER_ROLES.ADMIN) {
        router.push("/setup/models");
      } else {
        router.push("/setup/knowledges");
      }
    } else if (!userLoading && !user) {
      router.push("/");
    }
  }, [user, userLoading, router]);
  return null;
}
