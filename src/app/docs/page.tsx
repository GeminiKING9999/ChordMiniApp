// src/app/docs/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Navigation from '@/components/common/Navigation';
import { isDevelopmentEnvironment } from '@/utils/modelFiltering';
import { useTheme } from '@/contexts/ThemeContext';

import {
  FiActivity,
  FiCpu,
  FiFileText,
  FiServer,
  FiZap,
  FiInfo,
  FiMusic
} from 'react-icons/fi';
import { Card, CardBody, Chip } from '@heroui/react';

// Reusable Status Icon Component
const StatusIcon = ({ status }: { status: 'Operational' | 'Degraded' | 'Offline' | 'Active' | 'Enabled' }) => {
  let colorClass = 'bg-green-500';
  if (status === 'Degraded') colorClass = 'bg-yellow-500';
  if (status === 'Offline') colorClass = 'bg-red-500';
  if (status === 'Active' || status === 'Enabled') colorClass = 'bg-blue-500';
  
  return <div className={`w-3 h-3 ${colorClass} rounded-full animate-pulse`}></div>;
};

interface ModelCardProps {
  status: 'Operational' | 'Degraded' | 'Offline' | 'Active' | 'Enabled';
  title: string;
  description: React.ReactNode;
  footer: React.ReactNode;
  badgeLabel?: string;
  badgeColor?: 'success' | 'warning';
  accentClassName?: string;
}

const ModelCard = ({
  status,
  title,
  description,
  footer,
  badgeLabel,
  badgeColor = 'success',
  accentClassName = 'border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-900',
}: ModelCardProps) => (
  <Card shadow="sm" className={`transition-all hover:shadow-lg ${accentClassName}`}>
    <CardBody className="p-6">
      <div className="flex items-center gap-3 mb-3">
        <StatusIcon status={status} />
        <h4 className="font-semibold text-gray-900 dark:text-white">{title}</h4>
        {badgeLabel ? (
          <Chip
            size="sm"
            variant="flat"
            color={badgeColor}
            className="font-medium"
          >
            {badgeLabel}
          </Chip>
        ) : null}
      </div>
      <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
        {description}
      </p>
      <div className="text-xs text-gray-500 dark:text-gray-400">
        {footer}
      </div>
    </CardBody>
  </Card>
);

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState<string>('welcome');
  const { theme } = useTheme();
  void theme;

  useEffect(() => {
    const sectionIds = [
      'welcome',
      'capabilities',
      'models',
    ];

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      {
        rootMargin: '-20% 0px -80% 0px'
      }
    );

    sectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  const navItemClasses = (id: string) =>
    `flex items-center gap-2 text-sm py-2 px-3 rounded-md transition-colors ${
      activeSection === id
        ? 'bg-[#E8EDF6] dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-semibold'
        : 'text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-[#F5EFE4] dark:hover:bg-gray-800'
    }`;

  return (
    <div className="min-h-screen bg-background dark:bg-content-bg transition-colors duration-300">
      <Navigation />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        <div className="lg:grid lg:grid-cols-4 lg:gap-8">
          {/* Sidebar Navigation */}
          <div className="hidden lg:block lg:col-span-1 bg-[#FAF6EE] dark:bg-content-bg transition-colors duration-300">
            <div className="sticky top-20 rounded-2xl bg-[#FAF6EE] py-8 dark:bg-content-bg transition-colors duration-300">
              <nav className="space-y-6 bg-[#FAF6EE] dark:bg-content-bg">
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                    Overview
                  </h3>
                  <a href="#welcome" className={navItemClasses('welcome')}>
                    <FiInfo className="w-4 h-4" /> About
                  </a>
                  <a href="#capabilities" className={navItemClasses('capabilities')}>
                    <FiZap className="w-4 h-4" /> Capabilities
                  </a>
                </div>
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                    Technology
                  </h3>
                  <a href="#models" className={navItemClasses('models')}>
                    <FiCpu className="w-4 h-4" /> Models
                  </a>
                </div>
              </nav>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="lg:col-span-3 min-w-0 py-8">
            <div className="space-y-16">
              {/* Welcome / Overview */}
              <section id="welcome" className="scroll-mt-8">
                <div className="text-center space-y-4">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-50 dark:bg-blue-900/20 mx-auto">
                    <FiMusic className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 dark:text-white leading-tight">
                    Chord Reaper
                  </h1>
                  <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
                    AI-powered audio analysis for beat detection, chord recognition, and lyrics synchronization. Powered by state-of-the-art machine learning models.
                  </p>
                </div>
              </section>

              {/* Capabilities */}
              <section id="capabilities" className="scroll-mt-8">
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">Capabilities</h2>
                <div className="prose prose-gray dark:prose-invert max-w-none mb-8">
                  <p>
                    Chord Reaper analyzes audio to extract musical information using advanced deep learning models.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-6 mb-8">
                  <Card shadow="sm" className="hover:shadow-lg transition-all border border-gray-200 dark:border-gray-700">
                    <CardBody>
                      <div className="flex items-center gap-4 mb-2">
                        <FiActivity className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                        <h3 className="font-semibold text-gray-900 dark:text-white text-lg">Beat Detection</h3>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Identify beat positions, downbeats, BPM, and time signatures using neural network models.
                      </p>
                    </CardBody>
                  </Card>
                  <Card shadow="sm" className="hover:shadow-lg transition-all border border-gray-200 dark:border-gray-700">
                    <CardBody>
                      <div className="flex items-center gap-4 mb-2">
                        <FiCpu className="w-6 h-6 text-green-600 dark:text-green-400" />
                        <h3 className="font-semibold text-gray-900 dark:text-white text-lg">Chord Recognition</h3>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Recognize chord progressions with 301 chord labels using CNN-LSTM architecture.
                      </p>
                    </CardBody>
                  </Card>
                  <Card shadow="sm" className="hover:shadow-lg transition-all border border-gray-200 dark:border-gray-700">
                    <CardBody>
                      <div className="flex items-center gap-4 mb-2">
                        <FiFileText className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                        <h3 className="font-semibold text-gray-900 dark:text-white text-lg">Lyrics Synchronization</h3>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Fetch and display time-synced lyrics from LRClib and Genius databases.
                      </p>
                    </CardBody>
                  </Card>
                  <Card shadow="sm" className="hover:shadow-lg transition-all border border-gray-200 dark:border-gray-700">
                    <CardBody>
                      <div className="flex items-center gap-4 mb-2">
                        <FiServer className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                        <h3 className="font-semibold text-gray-900 dark:text-white text-lg">Song Structure</h3>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Segment songs into structural sections (verse, chorus, bridge) using SongFormer.
                      </p>
                    </CardBody>
                  </Card>
                </div>
              </section>

              {/* Models */}
              <section id="models" className="scroll-mt-8">
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">Models & Technology</h2>
                <div className="prose prose-gray dark:prose-invert max-w-none mb-8">
                  <p>
                    Chord Reaper uses multiple machine learning models, each optimized for specific audio analysis tasks.
                  </p>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Beat Detection Models</h3>
                <div className="grid md:grid-cols-2 gap-6 mb-8">
                  <ModelCard
                    status="Operational"
                    title="Madmom"
                    badgeLabel="Default"
                    description="Neural network with high accuracy and speed, best for common time signatures (3/4, 4/4)."
                    footer={<><strong>Best for:</strong> Pop, Rock, Electronic music</>}
                  />
                  <ModelCard
                    status="Operational"
                    title="Beat-Transformer"
                    description="Deep learning model with 5-channel audio separation, flexible in time signatures, slower processing speed."
                    footer={<><strong>Best for:</strong> Complex mixes, layered instrumentation</>}
                  />
                </div>

                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Chord Recognition Models</h3>
                <div className="grid gap-6 mb-8">
                  <ModelCard
                    status="Operational"
                    title="Chord-CNN-LSTM"
                    badgeLabel="Default"
                    description="Convolutional and LSTM neural network for chord recognition with 301 chord labels. Excellent balance of accuracy and performance."
                    footer={<><strong>Labels:</strong> 301 chord types &bull; <strong>Best for:</strong> General purpose chord recognition</>}
                  />
                  {isDevelopmentEnvironment() && (
                    <>
                      <ModelCard
                        status="Degraded"
                        title="BTC SL (Supervised Learning)"
                        badgeLabel="DEV ONLY"
                        badgeColor="warning"
                        accentClassName="border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20"
                        description={
                          <>
                            Transformer model with 170 chord labels, supervised learning approach.
                            <strong className="text-orange-600 dark:text-orange-400"> Development only.</strong>
                          </>
                        }
                        footer={<><strong>Labels:</strong> 170 chord types &bull; <strong>Best for:</strong> Research and development</>}
                      />
                      <ModelCard
                        status="Degraded"
                        title="BTC PL (Pseudo-Label)"
                        badgeLabel="DEV ONLY"
                        badgeColor="warning"
                        accentClassName="border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20"
                        description={
                          <>
                            Transformer model with 170 chord labels, pseudo-label training approach.
                            <strong className="text-orange-600 dark:text-orange-400"> Development only.</strong>
                          </>
                        }
                        footer={<><strong>Labels:</strong> 170 chord types &bull; <strong>Best for:</strong> Research and development</>}
                      />
                    </>
                  )}
                </div>

                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Song Structure Analysis</h3>
                <div className="grid gap-6">
                  <ModelCard
                    status="Operational"
                    title="SongFormer"
                    description="Transformer-based model for song structure segmentation. Identifies verse, chorus, bridge, intro, outro, and other musical sections."
                    footer={<><strong>Best for:</strong> Structural analysis and section-level song navigation</>}
                  />
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
