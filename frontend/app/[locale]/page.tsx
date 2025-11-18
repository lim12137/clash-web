"use client";

import { useState, useEffect } from "react";
import { useTranslation, Trans } from "react-i18next";
import { Button } from "@/components/ui/button";
import { NavigationLayout } from "@/components/navigation/NavigationLayout";
import { HomepageContent } from "@/components/homepage/HomepageContent";
import { LoginModal } from "@/components/auth/loginModal";
import { RegisterModal } from "@/components/auth/registerModal";
import { useAuth } from "@/hooks/useAuth";
import { Modal, ConfigProvider } from "antd";

export default function Home() {
  const [mounted, setMounted] = useState(false);

  // Prevent hydration errors
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <ConfigProvider getPopupContainer={() => document.body}>
      <FrontpageContent />
    </ConfigProvider>
  );

  function FrontpageContent() {
    const { t } = useTranslation("common");
    const {
      user,
      isLoading: userLoading,
      openLoginModal,
      openRegisterModal,
      isSpeedMode,
    } = useAuth();
    const [loginPromptOpen, setLoginPromptOpen] = useState(false);
    const [adminRequiredPromptOpen, setAdminRequiredPromptOpen] =
      useState(false);

    // Handle operations that require login
    const handleAuthRequired = () => {
      if (!isSpeedMode && !user) {
        setLoginPromptOpen(true);
      }
    };

    // Confirm login dialog
    const handleCloseLoginPrompt = () => {
      setLoginPromptOpen(false);
    };

    // Handle login button click
    const handleLoginClick = () => {
      setLoginPromptOpen(false);
      openLoginModal();
    };

    // Handle register button click
    const handleRegisterClick = () => {
      setLoginPromptOpen(false);
      openRegisterModal();
    };

    // Handle operations that require admin privileges
    const handleAdminRequired = () => {
      if (!isSpeedMode && user?.role !== "admin") {
        setAdminRequiredPromptOpen(true);
      }
    };

    // Close admin prompt dialog
    const handleCloseAdminPrompt = () => {
      setAdminRequiredPromptOpen(false);
    };

    return (
      <NavigationLayout
        onAuthRequired={handleAuthRequired}
        onAdminRequired={handleAdminRequired}
        showFooter={true}
        contentMode="centered"
      >
        <HomepageContent
          onAuthRequired={handleAuthRequired}
          onAdminRequired={handleAdminRequired}
        />

        {/* Login prompt dialog - only shown in full version */}
        {!isSpeedMode && (
          <Modal
            title={t("page.loginPrompt.title")}
            open={loginPromptOpen}
            onCancel={handleCloseLoginPrompt}
            footer={[
              <Button
                key="register"
                variant="link"
                onClick={handleRegisterClick}
                className="bg-white mr-2"
              >
                {t("page.loginPrompt.register")}
              </Button>,
              <Button
                key="login"
                onClick={handleLoginClick}
                className="bg-blue-600 text-white hover:bg-blue-700"
              >
                {t("page.loginPrompt.login")}
              </Button>,
            ]}
            centered
          >
            <div className="py-2">
              <h3 className="text-base font-medium mb-2">
                {t("page.loginPrompt.header")}
              </h3>
              <p className="text-gray-600 mb-3">
                {t("page.loginPrompt.intro")}
              </p>

              <div className="rounded-md mb-6 mt-3">
                <h3 className="text-base font-medium mb-1">
                  {t("page.loginPrompt.benefitsTitle")}
                </h3>
                <ul className="text-gray-600 pl-5 list-disc">
                  {(
                    t("page.loginPrompt.benefits", {
                      returnObjects: true,
                    }) as string[]
                  ).map((benefit, i) => (
                    <li key={i}>{benefit}</li>
                  ))}
                </ul>
              </div>

              <div className="mt-4">
                <p className="text-base font-medium">
                  <Trans i18nKey="page.loginPrompt.githubSupport">
                    ⭐️ Nexent is still growing, please help me by starring on{" "}
                    <a
                      href="https://github.com/ModelEngine-Group/nexent"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-700 font-bold"
                    >
                      GitHub
                    </a>
                    , thank you.
                  </Trans>
                </p>
              </div>
              <br />

              <p className="text-gray-500 text-xs">
                {t("page.loginPrompt.noAccount")}
              </p>
            </div>
          </Modal>
        )}

        {/* Login and register modals - only shown in full version */}
        {!isSpeedMode && (
          <>
            <LoginModal />
            <RegisterModal />
          </>
        )}

        {/* Admin prompt dialog - only shown in full version */}
        {!isSpeedMode && (
          <Modal
            title={t("page.adminPrompt.title")}
            open={adminRequiredPromptOpen}
            onCancel={handleCloseAdminPrompt}
            footer={[
              <Button
                key="register"
                variant="link"
                onClick={() => {
                  setAdminRequiredPromptOpen(false);
                  openRegisterModal();
                }}
                className="bg-white mr-2"
              >
                {t("page.loginPrompt.register")}
              </Button>,
              <Button
                key="login"
                onClick={() => {
                  setAdminRequiredPromptOpen(false);
                  openLoginModal();
                }}
                className="bg-blue-600 text-white hover:bg-blue-700"
              >
                {t("page.loginPrompt.login")}
              </Button>,
            ]}
            centered
          >
            <div className="py-2">
              <p className="text-gray-600">{t("page.adminPrompt.intro")}</p>
            </div>
            <div className="py-2">
              <h3 className="text-base font-medium mb-2">
                {t("page.adminPrompt.unlockHeader")}
              </h3>
              <p className="text-gray-600 mb-3">
                {t("page.adminPrompt.unlockIntro")}
              </p>
              <div className="rounded-md mb-6 mt-3">
                <h3 className="text-base font-medium mb-1">
                  {t("page.adminPrompt.permissionsTitle")}
                </h3>
                <ul className="text-gray-600 pl-5 list-disc">
                  {(
                    t("page.adminPrompt.permissions", {
                      returnObjects: true,
                    }) as string[]
                  ).map((permission, i) => (
                    <li key={i}>{permission}</li>
                  ))}
                </ul>
              </div>
              <div className="mt-4">
                <p className="text-base font-medium">
                  <Trans i18nKey="page.adminPrompt.githubSupport">
                    ⭐️ Nexent is still growing, please help me by starring on{" "}
                    <a
                      href="https://github.com/ModelEngine-Group/nexent"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-700 font-bold"
                    >
                      GitHub
                    </a>
                    , thank you.
                  </Trans>
                  <br />
                  <br />
                  <Trans i18nKey="page.adminPrompt.becomeAdmin">
                    💡 Want to become an administrator? Please visit the{" "}
                    <a
                      href="http://nexent.tech/contact"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-700 font-bold"
                    >
                      official contact page
                    </a>{" "}
                    to apply for an administrator account.
                  </Trans>
                </p>
              </div>
              <br />
            </div>
          </Modal>
        )}
      </NavigationLayout>
    );
  }
}
