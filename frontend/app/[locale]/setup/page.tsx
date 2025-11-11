"use client";

import {useEffect} from "react";
import {useRouter} from "next/navigation";
import {useAuth} from "@/hooks/useAuth";
import {USER_ROLES} from "@/const/modelConfig";

export default function SetupPage() {
  const router = useRouter();
  const { user, isLoading: userLoading, isSpeedMode } = useAuth();

  useEffect(() => {
    if (!userLoading) {
      if (isSpeedMode) {
        // In speed mode, go directly to models page
        router.push("/setup/models");
      } else if (user) {
        // Redirect based on user role
        if (user.role === USER_ROLES.ADMIN) {
          router.push("/setup/models");
        } else {
          router.push("/setup/knowledges");
        }
      } else {
        // Full mode without login, redirect to home
        router.push("/");
      }
    }
  }, [user, userLoading, isSpeedMode, router]);
  return null;
}
