'use client';

import React, { useState, useEffect } from 'react';
import { Navbar } from '@/components/Navbar';
import { Badge } from '@/components/Badge';
import { adminApi, CourseItem, QuestionItem, ResourceItem } from '@/lib/api';
import {
  BookOpen,
  HelpCircle,
  Database,
  Search,
  Plus,
  CheckCircle2,
  Edit2,
  FileText,
  Save,
  X,
  Layers,
  ShieldCheck,
  AlertCircle,
  Code2,
  Sparkles,
  Package,
  Copy,
  Check,
  DownloadCloud,
  FileCode,
  HardDrive,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';

function FormattedQuestionText({ text }: { text: string }) {
  // Split on fenced code blocks: ```lang\ncode\n```
  const parts = text.split(/(```[\s\S]*?```)/g);

  return (
    <div className="space-y-2.5">
      {parts.map((part, pIdx) => {
        if (part.startsWith('```') && part.endsWith('```')) {
          const firstLineEnd = part.indexOf('\n');
          let lang = '';
          let code = '';
          if (firstLineEnd !== -1) {
            lang = part.slice(3, firstLineEnd).trim();
            code = part.slice(firstLineEnd + 1, -3);
          } else {
            code = part.slice(3, -3);
          }
          return (
            <div
              key={pIdx}
              className="my-3 rounded-xl border border-slate-800 bg-[#070B14] overflow-hidden text-xs shadow-md"
            >
              <div className="flex items-center justify-between px-3.5 py-1.5 bg-[#0C1222] border-b border-slate-800/80 text-[11px] font-mono text-indigo-400 font-semibold tracking-wider">
                <div className="flex items-center gap-1.5">
                  <Code2 size={13} className="text-indigo-400" />
                  <span className="uppercase">{lang || 'CODE'}</span>
                </div>
                <span className="text-[10px] text-slate-500 font-normal lowercase">monospaced snippet</span>
              </div>
              <pre className="p-4 font-mono text-xs leading-relaxed text-indigo-100 overflow-x-auto whitespace-pre selection:bg-indigo-700 selection:text-white">
                <code>{code.replace(/\r\n/g, '\n')}</code>
              </pre>
            </div>
          );
        }

        const lines = part.split('\n');
        const elements: React.ReactNode[] = [];
        let tableBuffer: string[] = [];

        const flushTable = (key: number) => {
          if (tableBuffer.length === 0) return;
          const rows = tableBuffer
            .filter((l) => !l.trim().match(/^\|?\s*[-:]+[-| :]*\s*\|?$/))
            .map((l) =>
              l
                .split('|')
                .map((c) => c.trim())
                .filter((c, i, arr) => !(i === 0 && c === '') && !(i === arr.length - 1 && c === ''))
            );

          if (rows.length > 0) {
            const [headerRow, ...bodyRows] = rows;
            elements.push(
              <div key={`table-${key}`} className="my-2.5 overflow-x-auto rounded-lg border border-slate-800 shadow-sm">
                <table className="w-full text-xs text-left">
                  <thead className="bg-[#0C1222] text-indigo-300 border-b border-slate-800 font-mono text-[11px]">
                    <tr>
                      {headerRow.map((cell, cIdx) => (
                        <th key={cIdx} className="px-3.5 py-2 font-semibold">
                          {cell}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 bg-[#070B14] font-mono text-slate-300">
                    {bodyRows.map((r, rIdx) => (
                      <tr key={rIdx} className="hover:bg-slate-900/40">
                        {r.map((cell, cIdx) => (
                          <td key={cIdx} className="px-3.5 py-2">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          }
          tableBuffer = [];
        };

        lines.forEach((line, lIdx) => {
          if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
            tableBuffer.push(line);
          } else {
            flushTable(lIdx);
            if (line.trim().length > 0) {
              const inlineParts = line.split(/(`[^`]+`)/g);
              elements.push(
                <p key={`line-${lIdx}`} className="text-sm text-slate-200 leading-relaxed font-normal">
                  {inlineParts.map((sub, sIdx) => {
                    if (sub.startsWith('`') && sub.endsWith('`')) {
                      return (
                        <code
                          key={sIdx}
                          className="px-1.5 py-0.5 mx-0.5 text-xs font-mono bg-indigo-950/70 border border-indigo-800/50 text-indigo-300 rounded font-semibold"
                        >
                          {sub.slice(1, -1)}
                        </code>
                      );
                    }
                    return sub;
                  })}
                </p>
              );
            }
          }
        });
        flushTable(lines.length);

        return <div key={pIdx} className="space-y-1.5">{elements}</div>;
      })}
    </div>
  );
}

export default function CurriculumPage() {
  const [activeTab, setActiveTab] = useState<'courses' | 'questions' | 'resources' | 'database'>('courses');
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [resources, setResources] = useState<ResourceItem[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [bloomFilter, setBloomFilter] = useState<string>('ALL');
  const [questionSearch, setQuestionSearch] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  // Resource Filter State
  const [selectedResCourseId, setSelectedResCourseId] = useState<number | null>(null);
  const [resTypeFilter, setResTypeFilter] = useState<string>('ALL');
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  // Edit Course Modal State
  const [editingCourse, setEditingCourse] = useState<CourseItem | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editCreditHours, setEditCreditHours] = useState(3);
  const [editObjective, setEditObjective] = useState('');

  // Author Question Modal State
  const [showNewQuestionModal, setShowNewQuestionModal] = useState(false);
  const [newQuestionText, setNewQuestionText] = useState('');
  const [newBloomLevel, setNewBloomLevel] = useState('APPLY');
  const [newDifficulty, setNewDifficulty] = useState('MEDIUM');
  const [newExplanation, setNewExplanation] = useState('');
  const [newOptions, setNewOptions] = useState([
    { label: 'A', text: '', is_correct: true },
    { label: 'B', text: '', is_correct: false },
    { label: 'C', text: '', is_correct: false },
    { label: 'D', text: '', is_correct: false },
  ]);

  // Edit Existing Question Modal State (ADR-005)
  const [editingQuestion, setEditingQuestion] = useState<QuestionItem | null>(null);
  const [editQuestionText, setEditQuestionText] = useState('');
  const [editQuestionBloom, setEditQuestionBloom] = useState('APPLY');
  const [editQuestionDifficulty, setEditQuestionDifficulty] = useState('MEDIUM');
  const [editQuestionExplanation, setEditQuestionExplanation] = useState('');
  const [editQuestionOptions, setEditQuestionOptions] = useState<
    Array<{ label: string; text: string; is_correct: boolean }>
  >([]);

  // Resource Modal State (Create or Edit)
  const [showResourceModal, setShowResourceModal] = useState(false);
  const [editingResource, setEditingResource] = useState<ResourceItem | null>(null);
  const [resFormCourseId, setResFormCourseId] = useState<number>(1);
  const [resFormType, setResFormType] = useState<string>('PAST_EXAM');
  const [resFormTitle, setResFormTitle] = useState<string>('');
  const [resFormBucket, setResFormBucket] = useState<string>('course-packages');
  const [resFormKey, setResFormKey] = useState<string>('');
  const [resFormSize, setResFormSize] = useState<number>(784120);
  const [resFormChecksum, setResFormChecksum] = useState<string>('');
  const [resFormOffline, setResFormOffline] = useState<boolean>(true);

  const loadCourses = async () => {
    setIsLoading(true);
    try {
      const data = await adminApi.getCourses();
      setCourses(data);
    } catch (err) {
      console.error('Failed to load courses:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadQuestions = async () => {
    setIsLoading(true);
    try {
      const data = await adminApi.getQuestions({
        course_id: selectedCourseId || undefined,
        bloom_level: bloomFilter === 'ALL' ? undefined : bloomFilter,
        q: questionSearch || undefined,
        limit: 100,
      });
      setQuestions(data);
    } catch (err) {
      console.error('Failed to load questions:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadResources = async () => {
    setIsLoading(true);
    try {
      const data = await adminApi.getResources({
        course_id: selectedResCourseId || undefined,
        type: resTypeFilter === 'ALL' ? undefined : resTypeFilter,
      });
      setResources(data);
    } catch (err) {
      console.error('Failed to load resources:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'courses') {
      loadCourses();
    } else if (activeTab === 'questions') {
      loadQuestions();
    } else if (activeTab === 'resources') {
      loadResources();
    }
  }, [activeTab, selectedCourseId, bloomFilter, selectedResCourseId, resTypeFilter]);

  const handleSaveCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCourse) return;
    try {
      await adminApi.updateCourse(editingCourse.course_id, {
        title: editTitle,
        credit_hours: editCreditHours,
        general_objective: editObjective,
      });
      setEditingCourse(null);
      loadCourses();
      alert('Course updated successfully (version incremented)!');
    } catch (err: any) {
      alert(err.message || 'Failed to update course');
    }
  };

  const handleCreateQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourseId && courses.length > 0) {
      setSelectedCourseId(courses[0].course_id);
    }
    const targetCourse = selectedCourseId || courses[0]?.course_id || 1;

    try {
      await adminApi.createQuestion({
        course_id: targetCourse,
        question_text: newQuestionText,
        bloom_level: newBloomLevel,
        difficulty: newDifficulty,
        explanation: newExplanation,
        options: newOptions,
      });
      setShowNewQuestionModal(false);
      setNewQuestionText('');
      setNewExplanation('');
      loadQuestions();
      alert('Question authored and saved to database successfully!');
    } catch (err: any) {
      alert(err.message || 'Failed to create question');
    }
  };

  const handleOpenEditQuestion = (q: QuestionItem) => {
    setEditingQuestion(q);
    setEditQuestionText(q.question_text);
    setEditQuestionBloom(q.bloom_level);
    setEditQuestionDifficulty(q.difficulty || 'MEDIUM');
    setEditQuestionExplanation(q.explanation || '');
    setEditQuestionOptions(
      q.options.map((o) => ({
        label: o.label,
        text: o.text,
        is_correct: o.is_correct,
      }))
    );
  };

  const handleSaveEditQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingQuestion) return;
    try {
      await adminApi.updateQuestion(editingQuestion.question_id, {
        question_text: editQuestionText,
        bloom_level: editQuestionBloom,
        difficulty: editQuestionDifficulty,
        explanation: editQuestionExplanation,
        options: editQuestionOptions,
      });
      setEditingQuestion(null);
      loadQuestions();
      alert(
        `Question updated! Version incremented (v${(editingQuestion.version || 1) + 1}) per ADR-005 without altering prior student attempts.`
      );
    } catch (err: any) {
      alert(err.message || 'Failed to update question');
    }
  };

  const handleOpenResourceModal = (r?: ResourceItem) => {
    if (r) {
      setEditingResource(r);
      setResFormCourseId(r.course_id);
      setResFormType(r.type);
      setResFormTitle(r.title);
      setResFormBucket(r.storage_bucket);
      setResFormKey(r.storage_object_key);
      setResFormSize(r.file_size_bytes);
      setResFormChecksum(r.sha256_checksum || '');
      setResFormOffline(r.is_offline_eligible);
    } else {
      setEditingResource(null);
      setResFormCourseId(courses[0]?.course_id || 1);
      setResFormType('PAST_EXAM');
      setResFormTitle('');
      setResFormBucket('course-packages');
      setResFormKey('past-exams/');
      setResFormSize(0);
      setResFormChecksum('');
      setResFormOffline(true);
    }
    setShowResourceModal(true);
  };

  const handleSaveResource = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingResource) {
        await adminApi.updateResource(editingResource.resource_id, {
          title: resFormTitle,
          type: resFormType,
          storage_bucket: resFormBucket,
          storage_object_key: resFormKey,
          file_size_bytes: resFormSize,
          sha256_checksum: resFormChecksum || undefined,
          is_offline_eligible: resFormOffline,
        });
        alert(`Resource package updated (version incremented to v${editingResource.version + 1})!`);
      } else {
        await adminApi.createResource({
          course_id: resFormCourseId,
          type: resFormType,
          title: resFormTitle,
          storage_bucket: resFormBucket,
          storage_object_key: resFormKey,
          file_size_bytes: resFormSize,
          sha256_checksum: resFormChecksum || undefined,
          is_offline_eligible: resFormOffline,
        });
        alert('New course resource package registered successfully!');
      }
      setShowResourceModal(false);
      loadResources();
    } catch (err: any) {
      alert(err.message || 'Failed to save resource package');
    }
  };

  const handleToggleOfflineEligibility = async (r: ResourceItem) => {
    try {
      const updated = !r.is_offline_eligible;
      await adminApi.updateResource(r.resource_id, { is_offline_eligible: updated });
      setResources((prev) =>
        prev.map((item) => (item.resource_id === r.resource_id ? { ...item, is_offline_eligible: updated } : item))
      );
    } catch (err: any) {
      alert(err.message || 'Failed to toggle offline eligibility');
    }
  };

  const copyToClipboard = (text: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedHash(text);
      setTimeout(() => setCopiedHash(null), 2000);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 KB';
    if (bytes >= 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    }
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  const getBloomBadgeColor = (lvl: string) => {
    switch (lvl.toUpperCase()) {
      case 'REMEMBER':
        return 'bg-slate-900 text-slate-300 border-slate-700';
      case 'UNDERSTAND':
        return 'bg-blue-950 text-blue-300 border-blue-800';
      case 'APPLY':
        return 'bg-emerald-950 text-emerald-300 border-emerald-800';
      case 'ANALYSE':
      case 'ANALYZE':
        return 'bg-amber-950 text-amber-300 border-amber-800';
      case 'EVALUATE':
        return 'bg-purple-950 text-purple-300 border-purple-800';
      case 'CREATE':
        return 'bg-rose-950 text-rose-300 border-rose-800';
      default:
        return 'bg-indigo-950 text-indigo-300 border-indigo-800';
    }
  };

  const getDifficultyBadgeColor = (diff?: string) => {
    switch ((diff || '').toUpperCase()) {
      case 'EASY':
        return 'bg-emerald-950/70 text-emerald-400 border-emerald-850';
      case 'HARD':
        return 'bg-red-950/70 text-red-400 border-red-850';
      case 'MEDIUM':
      default:
        return 'bg-amber-950/70 text-amber-400 border-amber-850';
    }
  };

  const getResourceTypeBadge = (type: string) => {
    switch (type) {
      case 'PAST_EXAM':
        return 'bg-purple-950/80 text-purple-300 border-purple-800';
      case 'LECTURE_NOTE':
        return 'bg-blue-950/80 text-blue-300 border-blue-800';
      case 'REFERENCE_BOOK':
        return 'bg-amber-950/80 text-amber-300 border-amber-800';
      case 'LAB_CONTENT':
        return 'bg-emerald-950/80 text-emerald-300 border-emerald-800';
      case 'PROJECT_SPEC':
        return 'bg-cyan-950/80 text-cyan-300 border-cyan-800';
      default:
        return 'bg-slate-900 text-slate-300 border-slate-700';
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background">
      <Navbar
        title="Curriculum & Database Content Manager"
        subtitle="Manage 15 courses, exit exam item banks, and course-packages PDF bundles"
        onRefresh={() => {
          if (activeTab === 'courses') loadCourses();
          else if (activeTab === 'questions') loadQuestions();
          else if (activeTab === 'resources') loadResources();
        }}
        isRefreshing={isLoading}
      />

      <main className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Tab Controls */}
        <div className="flex border-b border-border gap-6">
          <button
            onClick={() => setActiveTab('courses')}
            className={`pb-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'courses'
                ? 'border-brand text-white'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <BookOpen size={16} />
            <span>15 Canonical Courses</span>
          </button>

          <button
            onClick={() => setActiveTab('questions')}
            className={`pb-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'questions'
                ? 'border-brand text-white'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <HelpCircle size={16} />
            <span>Exit Exam Item Bank</span>
          </button>

          <button
            onClick={() => setActiveTab('resources')}
            className={`pb-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'resources'
                ? 'border-brand text-white'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Package size={16} />
            <span>Resources & PDF Packages</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-950 text-indigo-400 font-mono">
              ADR-009
            </span>
          </button>

          <button
            onClick={() => setActiveTab('database')}
            className={`pb-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'database'
                ? 'border-brand text-white'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Database size={16} />
            <span>Database Migrations (12)</span>
          </button>
        </div>

        {/* Tab 1: 15 Canonical Courses */}
        {activeTab === 'courses' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {courses.map((c) => (
              <div
                key={c.course_id}
                className="bg-card border border-border rounded-xl p-5 hover:border-border-light transition-all shadow-sm flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-indigo-950 text-indigo-400 border border-indigo-800/60">
                      {c.code}
                    </span>
                    <span className="text-xs text-slate-400 font-medium">
                      Theme {c.theme_id} • {c.credit_hours} CH
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-white mb-2">{c.title}</h3>
                  <p className="text-xs text-slate-400 line-clamp-3 mb-4">
                    {c.general_objective || 'Core curriculum course for B.Sc. Information Technology graduation.'}
                  </p>
                </div>

                <div className="pt-3 border-t border-border flex items-center justify-between text-xs text-slate-400">
                  <div className="flex gap-3 items-center">
                    <span>{c.question_count} Questions</span>
                    <span>•</span>
                    <span>{c.resource_count} Resources</span>
                  </div>
                  <button
                    onClick={() => {
                      setEditingCourse(c);
                      setEditTitle(c.title);
                      setEditCreditHours(c.credit_hours);
                      setEditObjective(c.general_objective || '');
                    }}
                    className="p-1.5 hover:bg-surface-secondary text-indigo-400 hover:text-white rounded transition-colors flex items-center gap-1"
                    title="Edit Course"
                  >
                    <Edit2 size={14} />
                    <span className="text-[11px] font-medium">Edit</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tab 2: Question Bank */}
        {activeTab === 'questions' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <select
                  value={selectedCourseId || ''}
                  onChange={(e) => setSelectedCourseId(e.target.value ? Number(e.target.value) : null)}
                  className="bg-card border border-border rounded-lg text-xs py-2 px-3 text-white focus:outline-none focus:border-brand"
                >
                  <option value="">All 15 Courses</option>
                  {courses.map((c) => (
                    <option key={c.course_id} value={c.course_id}>
                      {c.code} — {c.title}
                    </option>
                  ))}
                </select>

                <select
                  value={bloomFilter}
                  onChange={(e) => setBloomFilter(e.target.value)}
                  className="bg-card border border-border rounded-lg text-xs py-2 px-3 text-white focus:outline-none focus:border-brand"
                >
                  <option value="ALL">All Bloom Levels</option>
                  {['REMEMBER', 'UNDERSTAND', 'APPLY', 'ANALYSE', 'EVALUATE', 'CREATE'].map((lvl) => (
                    <option key={lvl} value={lvl}>
                      {lvl}
                    </option>
                  ))}
                </select>

                <div className="relative">
                  <input
                    type="text"
                    value={questionSearch}
                    onChange={(e) => setQuestionSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && loadQuestions()}
                    placeholder="Search stems, code, options..."
                    className="bg-card border border-border rounded-lg text-xs py-2 pl-8 pr-3 text-white placeholder-slate-500 focus:outline-none focus:border-brand w-56"
                  />
                  <Search size={13} className="absolute left-2.5 top-2.5 text-slate-500" />
                </div>
                <button
                  onClick={() => loadQuestions()}
                  className="px-3 py-2 bg-surface-secondary hover:bg-surface-tertiary text-slate-200 text-xs font-medium rounded-lg border border-border transition-colors"
                >
                  Filter
                </button>
              </div>

              <button
                onClick={() => setShowNewQuestionModal(true)}
                className="flex items-center gap-2 px-3.5 py-2 bg-brand hover:bg-brand-hover text-white text-xs font-bold rounded-lg transition-colors shadow-md shadow-brand/20"
              >
                <Plus size={14} />
                <span>Author New Question</span>
              </button>
            </div>

            <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
              <div className="divide-y divide-border/60">
                {questions.length === 0 ? (
                  <div className="p-12 text-center text-sm text-slate-500">
                    No questions found for the selected course / Bloom filters.
                  </div>
                ) : (
                  questions.map((q, idx) => (
                    <div key={q.question_id} className="p-5 hover:bg-surface-secondary/40 transition-colors">
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2 py-0.5 text-[11px] font-mono font-bold rounded bg-slate-800/90 text-slate-300 border border-slate-700">
                            v{q.version || 1}
                          </span>
                          <span className="px-2.5 py-0.5 text-xs font-mono font-bold rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800/80">
                            {q.course_code}
                          </span>
                          <span
                            className={`px-2 py-0.5 text-[11px] font-semibold rounded border ${getBloomBadgeColor(
                              q.bloom_level
                            )}`}
                          >
                            {q.bloom_level}
                          </span>
                          <span
                            className={`px-2 py-0.5 text-[11px] font-semibold rounded border ${getDifficultyBadgeColor(
                              q.difficulty
                            )}`}
                          >
                            {q.difficulty || 'MEDIUM'}
                          </span>
                          <span className="text-xs text-slate-500 ml-1">
                            Item #{idx + 1}
                          </span>
                        </div>

                        <button
                          onClick={() => handleOpenEditQuestion(q)}
                          className="px-2.5 py-1 rounded bg-surface-secondary hover:bg-surface-tertiary text-indigo-400 hover:text-white border border-border text-xs font-medium flex items-center gap-1.5 transition-colors"
                        >
                          <Edit2 size={12} />
                          <span>Edit</span>
                        </button>
                      </div>

                      <div className="mb-4">
                        <FormattedQuestionText text={q.question_text} />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs mb-3">
                        {q.options.map((opt) => (
                          <div
                            key={opt.label}
                            className={`p-2.5 rounded-lg border ${
                              opt.is_correct
                                ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
                                : 'bg-surface-secondary border-border text-slate-400'
                            }`}
                          >
                            <span className="font-bold mr-2">({opt.label})</span>
                            <span className="leading-relaxed">{opt.text}</span>
                            {opt.is_correct && (
                              <span className="ml-2 text-[10px] font-bold text-emerald-400 uppercase">
                                ✓ Correct Key
                              </span>
                            )}
                          </div>
                        ))}
                      </div>

                      {q.explanation && (
                        <div className="p-3 rounded-lg bg-surface-secondary border border-border/80 text-xs text-slate-400">
                          <span className="font-bold text-slate-300 mr-1.5">Official Rationale:</span>
                          <span className="leading-relaxed">{q.explanation}</span>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Resources & PDF Packages (ADR-009) */}
        {activeTab === 'resources' && (
          <div className="space-y-4">
            {/* Filter and Register Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <select
                  value={selectedResCourseId || ''}
                  onChange={(e) => setSelectedResCourseId(e.target.value ? Number(e.target.value) : null)}
                  className="bg-card border border-border rounded-lg text-xs py-2 px-3 text-white focus:outline-none focus:border-brand"
                >
                  <option value="">All Courses ({courses.length})</option>
                  {courses.map((c) => (
                    <option key={c.course_id} value={c.course_id}>
                      {c.code} — {c.title}
                    </option>
                  ))}
                </select>

                <select
                  value={resTypeFilter}
                  onChange={(e) => setResTypeFilter(e.target.value)}
                  className="bg-card border border-border rounded-lg text-xs py-2 px-3 text-white focus:outline-none focus:border-brand"
                >
                  <option value="ALL">All Resource Types</option>
                  <option value="PAST_EXAM">PAST_EXAM</option>
                  <option value="LECTURE_NOTE">LECTURE_NOTE</option>
                  <option value="REFERENCE_BOOK">REFERENCE_BOOK</option>
                  <option value="LAB_CONTENT">LAB_CONTENT</option>
                  <option value="PROJECT_SPEC">PROJECT_SPEC</option>
                </select>

                <span className="text-xs text-slate-400">
                  {resources.length} packages loaded
                </span>
              </div>

              <button
                onClick={() => handleOpenResourceModal()}
                className="flex items-center gap-2 px-3.5 py-2 bg-brand hover:bg-brand-hover text-white text-xs font-bold rounded-lg transition-colors shadow-md shadow-brand/20"
              >
                <Plus size={14} />
                <span>Register Resource Package</span>
              </button>
            </div>

            {/* Resources Table */}
            <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-[#0C1222] text-slate-300 border-b border-border font-semibold uppercase text-[11px] tracking-wider">
                    <tr>
                      <th className="px-4 py-3">Resource Title & Course</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Storage Key (`course-packages`)</th>
                      <th className="px-4 py-3">Size</th>
                      <th className="px-4 py-3">SHA-256 Checksum</th>
                      <th className="px-4 py-3 text-center">Version</th>
                      <th className="px-4 py-3 text-center">Offline Eligible</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60 text-slate-300">
                    {resources.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-slate-500">
                          No course resources found for this filter.
                        </td>
                      </tr>
                    ) : (
                      resources.map((r) => (
                        <tr key={r.resource_id} className="hover:bg-surface-secondary/40 transition-colors">
                          {/* Title & Course */}
                          <td className="px-4 py-3">
                            <div className="font-semibold text-white max-w-sm truncate" title={r.title}>
                              {r.title}
                            </div>
                            <div className="text-[11px] text-indigo-400 font-mono mt-0.5">
                              {r.course_code} {r.course_title ? `— ${r.course_title}` : ''}
                            </div>
                          </td>

                          {/* Type Badge */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold border ${getResourceTypeBadge(
                                r.type
                              )}`}
                            >
                              {r.type}
                            </span>
                          </td>

                          {/* Bucket & Key */}
                          <td className="px-4 py-3 font-mono text-[11px] max-w-xs truncate text-slate-300" title={r.storage_object_key}>
                            <span className="text-slate-500">{r.storage_bucket} / </span>
                            <span>{r.storage_object_key}</span>
                          </td>

                          {/* Size */}
                          <td className="px-4 py-3 whitespace-nowrap font-mono text-[11px] text-slate-300">
                            {formatFileSize(r.file_size_bytes)}
                          </td>

                          {/* SHA-256 Checksum Badge */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            {r.sha256_checksum ? (
                              <div className="flex items-center gap-1.5">
                                <span className="px-2 py-0.5 rounded bg-surface-secondary border border-border font-mono text-[10px] text-slate-300">
                                  {r.sha256_checksum.slice(0, 8)}...{r.sha256_checksum.slice(-6)}
                                </span>
                                <button
                                  onClick={() => copyToClipboard(r.sha256_checksum || '')}
                                  className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors"
                                  title="Copy full SHA-256 checksum"
                                >
                                  {copiedHash === r.sha256_checksum ? (
                                    <Check size={12} className="text-emerald-400" />
                                  ) : (
                                    <Copy size={12} />
                                  )}
                                </button>
                              </div>
                            ) : (
                              <span className="text-[10px] text-slate-600 font-mono">none</span>
                            )}
                          </td>

                          {/* Version */}
                          <td className="px-4 py-3 text-center whitespace-nowrap font-mono">
                            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 text-[11px] font-bold">
                              v{r.version || 1}
                            </span>
                          </td>

                          {/* Offline Eligible Toggle */}
                          <td className="px-4 py-3 text-center whitespace-nowrap">
                            <button
                              onClick={() => handleToggleOfflineEligibility(r)}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all ${
                                r.is_offline_eligible
                                  ? 'bg-emerald-950/60 border-emerald-700 text-emerald-300 hover:bg-emerald-950'
                                  : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
                              }`}
                              title="Click to toggle offline availability on mobile devices"
                            >
                              <DownloadCloud size={12} />
                              <span>{r.is_offline_eligible ? 'Enabled' : 'Disabled'}</span>
                            </button>
                          </td>

                          {/* Actions */}
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <button
                              onClick={() => handleOpenResourceModal(r)}
                              className="px-2.5 py-1 rounded bg-surface-secondary hover:bg-surface-tertiary text-indigo-400 hover:text-white border border-border text-xs font-medium inline-flex items-center gap-1 transition-colors"
                            >
                              <Edit2 size={12} />
                              <span>Edit</span>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Database & Migrations */}
        {activeTab === 'database' && (
          <div className="space-y-4">
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="text-sm font-bold text-white mb-1">
                Supabase Cloud Idempotent Migrations (12 / 12 Applied)
              </h3>
              <p className="text-xs text-slate-400 mb-4">
                PostgreSQL 16 with pgvector(384) running in eu-west-1 datacenter.
              </p>

              <div className="space-y-2 font-mono text-xs">
                {[
                  '20261114000001_init_reconciled_schema.sql (13 Tables, RLS, Enum types)',
                  '20261114000002_seed_curriculum.sql (5 Themes, 15 Canonical Courses)',
                  '20261114000003_seed_learning_outcomes.sql (Bloom taxonomy levels)',
                  '20261114000004_fix_rls_and_session_pooler.sql (PgBouncer compatibility)',
                  '20261114000005_seed_exit_exam_blueprints.sql (HU Jan 2023 Blueprint)',
                  '20261114000006_fix_monotonic_sync_trigger.sql (Sequence integrity)',
                  '20261114120000_seed_hu_model_exam_2023.sql (100 Questions, 420 Options)',
                  '20261114180000_add_missing_rls_policies.sql (Cross-tenant boundaries)',
                  '20261114200000_fix_grading_and_search_path.sql (public.grade_exam_attempt)',
                  '20261114220000_itec4133_question_bank_metadata.sql (Theme 5 taxonomy)',
                  '20261115120000_seed_products_catalog.sql (ETB Pricing, Telebirr/Chapa)',
                  '20261115220000_admin_audit_logs.sql (FR-026 Security & Governance)',
                ].map((mig, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 rounded bg-surface-secondary border border-border"
                  >
                    <span className="text-slate-300">{mig}</span>
                    <span className="text-emerald-400 font-bold text-[11px] flex items-center gap-1">
                      <CheckCircle2 size={13} />
                      Applied
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Edit Course Modal */}
        {editingCourse && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-xl w-full max-w-lg p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="text-base font-bold text-white">Edit Course: {editingCourse.code}</h3>
                <button onClick={() => setEditingCourse(null)} className="text-slate-400 hover:text-white">
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveCourse} className="space-y-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Course Title</label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-secondary border border-border rounded text-sm text-white focus:outline-none focus:border-brand"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Credit Hours</label>
                  <input
                    type="number"
                    min="1"
                    max="6"
                    value={editCreditHours}
                    onChange={(e) => setEditCreditHours(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-surface-secondary border border-border rounded text-sm text-white focus:outline-none focus:border-brand"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">General Objective</label>
                  <textarea
                    rows={3}
                    value={editObjective}
                    onChange={(e) => setEditObjective(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-secondary border border-border rounded text-sm text-white focus:outline-none focus:border-brand"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditingCourse(null)}
                    className="px-4 py-2 bg-surface-secondary hover:bg-surface-tertiary text-slate-300 text-xs font-semibold rounded"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-brand hover:bg-brand-hover text-white text-xs font-bold rounded"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Question Modal (ADR-005 Protected) */}
        {editingQuestion && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-white">Edit Question Item</h3>
                  <span className="px-2 py-0.5 text-xs font-mono font-bold rounded bg-indigo-950 text-indigo-400 border border-indigo-800/80">
                    {editingQuestion.course_code}
                  </span>
                  <span className="px-2 py-0.5 text-xs font-mono font-bold rounded bg-slate-800 text-slate-300">
                    Current: v{editingQuestion.version || 1}
                  </span>
                </div>
                <button onClick={() => setEditingQuestion(null)} className="text-slate-400 hover:text-white">
                  <X size={18} />
                </button>
              </div>

              {/* ADR-005 Invariant Banner */}
              <div className="p-3 rounded-lg bg-indigo-950/60 border border-indigo-800/80 text-xs text-indigo-300 flex items-start gap-2.5 shadow-sm">
                <ShieldCheck size={18} className="text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-white block">ADR-005 Protected</span>
                  Saving edits increments question version (v{editingQuestion.version || 1} → v
                  {(editingQuestion.version || 1) + 1}) for future exams without altering historical student attempt
                  snapshots.
                </div>
              </div>

              <form onSubmit={handleSaveEditQuestion} className="space-y-4">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">
                    Question Stem & Code Snippets (supports Markdown & ```language code blocks)
                  </label>
                  <textarea
                    rows={6}
                    required
                    value={editQuestionText}
                    onChange={(e) => setEditQuestionText(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-secondary border border-border rounded text-sm text-white font-mono focus:outline-none focus:border-brand"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Bloom's Taxonomy Level</label>
                    <select
                      value={editQuestionBloom}
                      onChange={(e) => setEditQuestionBloom(e.target.value)}
                      className="w-full px-3 py-2 bg-surface-secondary border border-border rounded text-xs text-white"
                    >
                      {['REMEMBER', 'UNDERSTAND', 'APPLY', 'ANALYSE', 'EVALUATE', 'CREATE'].map((lvl) => (
                        <option key={lvl} value={lvl}>
                          {lvl}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Difficulty</label>
                    <select
                      value={editQuestionDifficulty}
                      onChange={(e) => setEditQuestionDifficulty(e.target.value)}
                      className="w-full px-3 py-2 bg-surface-secondary border border-border rounded text-xs text-white"
                    >
                      {['EASY', 'MEDIUM', 'HARD'].map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Options List */}
                <div className="space-y-2">
                  <label className="text-xs text-slate-400 block">Options & Correct Answer Key</label>
                  {editQuestionOptions.map((opt, idx) => (
                    <div key={opt.label} className="flex items-center gap-2">
                      <span className="w-7 text-xs font-bold text-indigo-400">({opt.label})</span>
                      <input
                        type="text"
                        required
                        value={opt.text}
                        onChange={(e) => {
                          const updated = [...editQuestionOptions];
                          updated[idx].text = e.target.value;
                          setEditQuestionOptions(updated);
                        }}
                        className="flex-1 px-3 py-1.5 bg-surface-secondary border border-border rounded text-sm text-white"
                      />
                      <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                        <input
                          type="radio"
                          name="edit-correct-option"
                          checked={opt.is_correct}
                          onChange={() => {
                            const updated = editQuestionOptions.map((o, i) => ({
                              ...o,
                              is_correct: i === idx,
                            }));
                            setEditQuestionOptions(updated);
                          }}
                        />
                        <span>Correct</span>
                      </label>
                    </div>
                  ))}
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">Official Author Explanation</label>
                  <textarea
                    rows={3}
                    value={editQuestionExplanation}
                    onChange={(e) => setEditQuestionExplanation(e.target.value)}
                    placeholder="Pedagogical rationale explaining why the correct choice was selected..."
                    className="w-full px-3 py-2 bg-surface-secondary border border-border rounded text-sm text-white focus:outline-none focus:border-brand"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setEditingQuestion(null)}
                    className="px-4 py-2 bg-surface-secondary hover:bg-surface-tertiary text-slate-300 text-xs font-semibold rounded"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-brand hover:bg-brand-hover text-white text-xs font-bold rounded flex items-center gap-1.5 shadow-md shadow-brand/20"
                  >
                    <Save size={14} />
                    <span>Save Edits & Increment Version</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Register / Update Resource Package Modal (ADR-009) */}
        {showResourceModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-xl w-full max-w-xl max-h-[90vh] overflow-y-auto p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <Package size={18} className="text-indigo-400" />
                  <h3 className="text-base font-bold text-white">
                    {editingResource
                      ? `Update Resource: ${editingResource.title.slice(0, 30)}...`
                      : 'Register Resource Package (ADR-009)'}
                  </h3>
                  {editingResource && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300">
                      v{editingResource.version} → v{editingResource.version + 1}
                    </span>
                  )}
                </div>
                <button onClick={() => setShowResourceModal(false)} className="text-slate-400 hover:text-white">
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveResource} className="space-y-4">
                {/* Target Course (Disabled in Edit mode) */}
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Target Course</label>
                  <select
                    disabled={!!editingResource}
                    value={resFormCourseId}
                    onChange={(e) => setResFormCourseId(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-surface-secondary border border-border rounded text-xs text-white disabled:opacity-60"
                  >
                    {courses.map((c) => (
                      <option key={c.course_id} value={c.course_id}>
                        {c.code} — {c.title}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Resource Title & Type */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="text-xs text-slate-400 block mb-1">Resource Title</label>
                    <input
                      type="text"
                      required
                      value={resFormTitle}
                      onChange={(e) => setResFormTitle(e.target.value)}
                      placeholder="e.g. HU CCI Model Exit Exam 2023 (PDF)"
                      className="w-full px-3 py-2 bg-surface-secondary border border-border rounded text-sm text-white focus:outline-none focus:border-brand"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Resource Type</label>
                    <select
                      value={resFormType}
                      onChange={(e) => setResFormType(e.target.value)}
                      className="w-full px-3 py-2 bg-surface-secondary border border-border rounded text-xs text-white"
                    >
                      <option value="PAST_EXAM">PAST_EXAM</option>
                      <option value="LECTURE_NOTE">LECTURE_NOTE</option>
                      <option value="REFERENCE_BOOK">REFERENCE_BOOK</option>
                      <option value="LAB_CONTENT">LAB_CONTENT</option>
                      <option value="PROJECT_SPEC">PROJECT_SPEC</option>
                    </select>
                  </div>
                </div>

                {/* Storage Bucket & Object Key */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Storage Bucket</label>
                    <input
                      type="text"
                      required
                      value={resFormBucket}
                      onChange={(e) => setResFormBucket(e.target.value)}
                      className="w-full px-3 py-2 bg-surface-secondary border border-border rounded text-xs font-mono text-slate-300"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="text-xs text-slate-400 block mb-1">Storage Object Key</label>
                    <input
                      type="text"
                      required
                      value={resFormKey}
                      onChange={(e) => setResFormKey(e.target.value)}
                      placeholder="e.g. past-exams/HU-CCI-IT-Model-Exit-Exam-2023.pdf"
                      className="w-full px-3 py-2 bg-surface-secondary border border-border rounded text-xs font-mono text-white focus:outline-none focus:border-brand"
                    />
                  </div>
                </div>

                {/* File Size & Checksum */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Size (Bytes)</label>
                    <input
                      type="number"
                      min="0"
                      value={resFormSize}
                      onChange={(e) => setResFormSize(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-surface-secondary border border-border rounded text-xs font-mono text-white"
                    />
                    <span className="text-[10px] text-slate-500 font-mono mt-0.5 block">
                      ≈ {formatFileSize(resFormSize)}
                    </span>
                  </div>

                  <div className="col-span-2">
                    <label className="text-xs text-slate-400 block mb-1">SHA-256 Checksum (Hex)</label>
                    <input
                      type="text"
                      value={resFormChecksum}
                      onChange={(e) => setResFormChecksum(e.target.value)}
                      placeholder="64-character hex hash"
                      className="w-full px-3 py-2 bg-surface-secondary border border-border rounded text-xs font-mono text-white focus:outline-none focus:border-brand"
                    />
                  </div>
                </div>

                {/* Offline Eligible Checkbox */}
                <div className="p-3 rounded-lg bg-surface-secondary border border-border flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-white block">Offline Eligible Download</span>
                    <span className="text-[11px] text-slate-400">
                      Allows mobile students to cache this bundle for offline practice.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={resFormOffline}
                    onChange={(e) => setResFormOffline(e.target.checked)}
                    className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setShowResourceModal(false)}
                    className="px-4 py-2 bg-surface-secondary hover:bg-surface-tertiary text-slate-300 text-xs font-semibold rounded"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-brand hover:bg-brand-hover text-white text-xs font-bold rounded flex items-center gap-1.5 shadow-md shadow-brand/20"
                  >
                    <Save size={14} />
                    <span>{editingResource ? 'Save Resource Changes' : 'Register Resource'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Author New Question Modal */}
        {showNewQuestionModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="text-base font-bold text-white">Author New Exit Exam Question</h3>
                <button onClick={() => setShowNewQuestionModal(false)} className="text-slate-400 hover:text-white">
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleCreateQuestion} className="space-y-4">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">
                    Question Stem (Supports Markdown & ```code blocks)
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={newQuestionText}
                    onChange={(e) => setNewQuestionText(e.target.value)}
                    placeholder="Enter the scenario or problem stem..."
                    className="w-full px-3 py-2 bg-surface-secondary border border-border rounded text-sm text-white font-mono focus:outline-none focus:border-brand"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Bloom's Taxonomy Level</label>
                    <select
                      value={newBloomLevel}
                      onChange={(e) => setNewBloomLevel(e.target.value)}
                      className="w-full px-3 py-2 bg-surface-secondary border border-border rounded text-xs text-white"
                    >
                      {['REMEMBER', 'UNDERSTAND', 'APPLY', 'ANALYSE', 'EVALUATE', 'CREATE'].map((lvl) => (
                        <option key={lvl} value={lvl}>
                          {lvl}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Difficulty</label>
                    <select
                      value={newDifficulty}
                      onChange={(e) => setNewDifficulty(e.target.value)}
                      className="w-full px-3 py-2 bg-surface-secondary border border-border rounded text-xs text-white"
                    >
                      {['EASY', 'MEDIUM', 'HARD'].map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Target Course</label>
                    <select
                      value={selectedCourseId || courses[0]?.course_id || 1}
                      onChange={(e) => setSelectedCourseId(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-surface-secondary border border-border rounded text-xs text-white"
                    >
                      {courses.map((c) => (
                        <option key={c.course_id} value={c.course_id}>
                          {c.code} — {c.title}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 4 Options */}
                <div className="space-y-2">
                  <label className="text-xs text-slate-400 block">Options & Correct Key</label>
                  {newOptions.map((opt, idx) => (
                    <div key={opt.label} className="flex items-center gap-2">
                      <span className="w-7 text-xs font-bold text-indigo-400">({opt.label})</span>
                      <input
                        type="text"
                        required
                        value={opt.text}
                        onChange={(e) => {
                          const updated = [...newOptions];
                          updated[idx].text = e.target.value;
                          setNewOptions(updated);
                        }}
                        placeholder={`Option ${opt.label} text...`}
                        className="flex-1 px-3 py-1.5 bg-surface-secondary border border-border rounded text-sm text-white"
                      />
                      <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                        <input
                          type="radio"
                          name="correct-option"
                          checked={opt.is_correct}
                          onChange={() => {
                            const updated = newOptions.map((o, i) => ({
                              ...o,
                              is_correct: i === idx,
                            }));
                            setNewOptions(updated);
                          }}
                        />
                        <span>Correct</span>
                      </label>
                    </div>
                  ))}
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">Official Author Explanation</label>
                  <textarea
                    rows={2}
                    value={newExplanation}
                    onChange={(e) => setNewExplanation(e.target.value)}
                    placeholder="Pedagogical rationale explaining why the correct choice was selected..."
                    className="w-full px-3 py-2 bg-surface-secondary border border-border rounded text-sm text-white focus:outline-none focus:border-brand"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setShowNewQuestionModal(false)}
                    className="px-4 py-2 bg-surface-secondary hover:bg-surface-tertiary text-slate-300 text-xs font-semibold rounded"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-brand hover:bg-brand-hover text-white text-xs font-bold rounded"
                  >
                    Author & Save
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
