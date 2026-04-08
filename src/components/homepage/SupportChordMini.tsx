'use client';

import dynamic from 'next/dynamic';
import React, { useState } from 'react';
import { Button } from '@heroui/react';
import { FaGithub, FaCoffee, FaStar } from 'react-icons/fa';
import { HiSparkles, HiChevronDown, HiChevronUp } from 'react-icons/hi2';
import { HiMail } from 'react-icons/hi';

const AnimatedBorderText = dynamic(() => import('@/components/homepage/AnimatedBorderText'), {
  loading: () => <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>,
  ssr: false
});

const SupportChordMini: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(true);
  
  return (
    <div className="w-full space-y-4">
      {/* Collapsible Action Buttons Section */}
      <AnimatedBorderText>
        <div className="p-3 w-full rounded-lg bg-white dark:bg-content-bg">
          {/* Collapsible Header */}
          <button
            className="flex justify-between items-center cursor-pointer w-full text-left"
            onClick={() => setIsExpanded(!isExpanded)}
            aria-expanded={isExpanded}
            aria-controls="support-actions-content"
            type="button"
          >
            <h4 className="text-sm font-medium text-gray-800 dark:text-gray-200">Support Actions</h4>
            {isExpanded ? (
              <HiChevronUp className="w-5 h-5 text-gray-700 dark:text-gray-300" />
            ) : (
              <HiChevronDown className="w-5 h-5 text-gray-700 dark:text-gray-300" />
            )}
          </button>

          {/* Collapsible Content */}
          {isExpanded && (
            <div id="support-actions-content" className="mt-4 space-y-3">
              <Button
                as="a"
                href="https://github.com/GeminiKING9999/ChordMiniApp"
                target="_blank"
                rel="noopener noreferrer"
                variant="light"
                size="sm"
                startContent={<FaStar className="w-4 h-4 text-yellow-500" />}
                className="w-full justify-start text-sm text-yellow-600 dark:text-yellow-400 hover:text-yellow-700 dark:hover:text-yellow-300"
              >
                Star on GitHub
              </Button>
              <Button
                as="a"
                href="https://github.com/GeminiKING9999/ChordMiniApp/issues"
                target="_blank"
                rel="noopener noreferrer"
                variant="light"
                size="sm"
                startContent={<FaGithub className="w-4 h-4" />}
                className="w-full justify-start text-sm text-gray-800 dark:text-gray-200 hover:text-primary"
              >
                Report Issues & Feedback
              </Button>
              <Button
                as="a"
                href="mailto:contact@eclecticemporium.store"
                variant="light"
                size="sm"
                startContent={<HiMail className="w-4 h-4" />}
                className="w-full justify-start text-sm text-gray-800 dark:text-gray-200 hover:text-primary"
              >
                Contact Developer
              </Button>
              <Button
                as="a"
                href="https://buymeacoffee.com/nghiaphan"
                target="_blank"
                rel="noopener noreferrer"
                variant="light"
                size="sm"
                startContent={<FaCoffee className="w-4 h-4" />}
                className="w-full justify-start text-sm text-gray-800 dark:text-gray-200 hover:text-primary"
              >
                Donation
              </Button>
            </div>
          )}
        </div>
      </AnimatedBorderText>

      {/* Research / Fact Component */}
      <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg border border-purple-200 dark:border-purple-800">
        <div className="flex items-start gap-3">
          <HiSparkles className="w-5 h-5 text-purple-600 dark:text-purple-300 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-purple-700 dark:text-purple-200">
            <p className="font-medium text-purple-800 dark:text-purple-100 mb-1">Open Source Project</p>
            <p>Eclectify is an open-source AI-powered music analysis tool. Your support helps keep the servers running and enables new features.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SupportChordMini;