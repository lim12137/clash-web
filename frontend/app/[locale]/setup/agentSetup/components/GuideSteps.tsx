"use client"

import { Steps } from 'antd'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

// Timeline Step Configuration
const getGuideSteps = (t: any) => [
  {
    title: t('guide.steps.createOrEditAgent.title'),
    description: t('guide.steps.createOrEditAgent.description'),
  },
  {
    title: t('guide.steps.selectCollaborativeAgent.title'),
    description: t('guide.steps.selectCollaborativeAgent.description'),
  },
  {
    title: t('guide.steps.selectTools.title'),
    description: t('guide.steps.selectTools.description'),
  },
  {
    title: t('guide.steps.describeBusinessLogic.title'),
    description: t('guide.steps.describeBusinessLogic.description'),
  },
  {
    title: t('guide.steps.generateAndDebug.title'),
    description: t('guide.steps.generateAndDebug.description'),
  },
  {
    title: t('guide.steps.completeCreation.title'),
    description: t('guide.steps.completeCreation.description'),
  }
];

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
  isEditingAgent?: boolean;
  dutyContent?: string;
  constraintContent?: string;
  fewShotsContent?: string;
  enabledAgentIds?: number[];
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
  isEditingAgent = false,
  dutyContent = '',
  constraintContent = '',
  fewShotsContent = '',
  enabledAgentIds = [],
}: GuideStepsProps) {
  const { t } = useTranslation('common');
  const GUIDE_STEPS = getGuideSteps(t);

  useEffect(() => {
    console.log('Current mainAgentId:', mainAgentId);
  }, [mainAgentId]);

  // Get Current Step
  const getCurrentStep = () => {
    // Unified step judgment logic, whether in creation mode or editing mode
    if (systemPrompt || (dutyContent?.trim()) || (constraintContent?.trim()) || (fewShotsContent?.trim())) {
      return 4; // Generate agent and debug
    }
    if (businessLogic && businessLogic.trim() !== '') {
      return 3; // Describe business logic
    }
    if (selectedTools.length > 0) {
      return 2; // Select tools to use
    }
    // Use enabledAgentIds to determine if collaborative agents are selected, as this is the actual state managing collaborative agent selection
    if (enabledAgentIds.length > 0) {
      return 1; // Select collaborative agents
    }
    if (isCreatingNewAgent || isEditingAgent) {
      return 0; // Create/modify agent
    }
    return 0; // Default first step
  };

  // Use external currentStep if provided
  const step = typeof currentStep === 'number' ? currentStep : getCurrentStep();

  return (
    <div className="h-full flex flex-col">
      <h2 className="text-xl font-bold mb-5 px-2 flex-shrink-0">
        {t('guide.title.agentConfig')}
      </h2>
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <Steps
          direction="vertical"
          current={step}
          items={GUIDE_STEPS}
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