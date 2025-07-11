"use client"

import { Steps } from 'antd'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

// Timeline Step Configuration
const getGuideSteps = (t: any) => ({
  normal: [
    {
      title: t('guide.steps.normal.selectAgent.title'),
      description: t('guide.steps.normal.selectAgent.description'),
    },
    {
      title: t('guide.steps.normal.selectTools.title'),
      description: t('guide.steps.normal.selectTools.description'),
    },
    {
      title: t('guide.steps.normal.describeBusiness.title'),
      description: t('guide.steps.normal.describeBusiness.description'),
    },
    {
      title: t('guide.steps.normal.generatePrompt.title'),
      description: t('guide.steps.normal.generatePrompt.description'),
    },
    {
      title: t('guide.steps.normal.debugAgent.title'),
      description: t('guide.steps.normal.debugAgent.description'),
    },
    {
      title: t('guide.steps.normal.complete.title'),
      description: t('guide.steps.normal.complete.description'),
    }
  ],
  creating: [
    {
      title: t('guide.steps.creating.basicInfo.title'),
      description: t('guide.steps.creating.basicInfo.description'),
    },
    {
      title: t('guide.steps.creating.selectTools.title'),
      description: t('guide.steps.creating.selectTools.description'),
    },
    {
      title: t('guide.steps.creating.describeBusiness.title'),
      description: t('guide.steps.creating.describeBusiness.description'),
    },
    {
      title: t('guide.steps.creating.generatePrompt.title'),
      description: t('guide.steps.creating.generatePrompt.description'),
    },
    {
      title: t('guide.steps.creating.debugAgent.title'),
      description: t('guide.steps.creating.debugAgent.description'),
    },
    {
      title: t('guide.steps.creating.saveAgent.title'),
      description: t('guide.steps.creating.saveAgent.description'),
    },
  ]
});

interface GuideStepsProps {
  isCreatingNewAgent: boolean;
  systemPrompt: string;
  businessLogic: string;
  selectedTools: any[];
  selectedAgents: any[];
  mainAgentId: string | null;
  currentStep?: number;
  agentName?: string;
  agentDescription?: string;
  agentProvideSummary?: boolean;
}

export default function GuideSteps({
  isCreatingNewAgent,
  systemPrompt,
  businessLogic,
  selectedTools,
  selectedAgents,
  mainAgentId,
  currentStep,
  agentName = '',
  agentDescription = '',
  agentProvideSummary = false,
}: GuideStepsProps) {
  const { t } = useTranslation('common');
  const GUIDE_STEPS = getGuideSteps(t);

  useEffect(() => {
    console.log('当前 mainAgentId:', mainAgentId);
  }, [mainAgentId]);

  // Get Current Step
  const getCurrentStep = () => {
    if (isCreatingNewAgent) {
      // Sub Agent configuration mode step sequence
      if (systemPrompt) return 4;
      if (businessLogic) return 3;
      if (selectedTools.length > 0) return 2;
      if (agentName.trim() && agentDescription.trim()) return 1;
      return 0;
    } else {
      // Main Agent configuration mode step sequence
      if (systemPrompt) return 4;
      if (businessLogic) return 3;
      if (selectedTools.length > 0) return 2;
      if (selectedAgents.length > 0) return 1;
      return 0;
    }
  };

  // Use external currentStep if provided
  const step = typeof currentStep === 'number' ? currentStep : getCurrentStep();

  return (
    <div className="h-[65vh]">
      <div className="flex-1 flex flex-col h-full overflow-y-auto overflow-x-hidden">
        <h2 className="text-xl font-bold mb-4">
          {isCreatingNewAgent ? t('guide.title.subAgent') : t('guide.title.mainAgent')}
        </h2>
        <Steps
          direction="vertical"
          current={step}
          items={isCreatingNewAgent ? GUIDE_STEPS.creating : GUIDE_STEPS.normal}
          className="px-2 custom-guide-steps h-full"
        />
      </div>
      <style jsx global>{`
        .custom-guide-steps.ant-steps-vertical {
          height: 100%;
          display: flex;
          flex-direction: column;
        }
        .custom-guide-steps .ant-steps-item {
          flex: 1;
          min-height: 0;
          margin-bottom: 0;
          padding-bottom: 0;
        }
        .custom-guide-steps .ant-steps-item-content {
          display: flex;
          flex-direction: column;
          justify-content: center;
          height: 100%;
        }
      `}</style>
    </div>
  );
} 