'use client';

import React, { useState, useEffect } from 'react';
import { Navbar } from '@/components/Navbar';
import { Badge } from '@/components/Badge';
import { adminApi, CourseItem, QuestionItem } from '@/lib/api';
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
} from 'lucide-react';

export default function CurriculumPage() {
  const [activeTab, setActiveTab] = useState<'courses' | 'questions' | 'database'>('courses');
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [bloomFilter, setBloomFilter] = useState<string>('ALL');
  const [questionSearch, setQuestionSearch] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  // Edit Course Modal State
  const [editingCourse, setEditingCourse] = useState<CourseItem | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editCreditHours, setEditCreditHours] = useState(3);
  const [editObjective, setEditObjective] = useState('');

  // New Question Modal State
  const [showNewQuestionModal, setShowNewQuestionModal] = useState(false);
  const [newQuestionText, setNewQuestionText] = useState('');
  const [newBloomLevel, setNewBloomLevel] = useState('APPLY');
  const [newExplanation, setNewExplanation] = useState('');
  const [newOptions, setNewOptions] = useState([
    { label: 'A', text: '', is_correct: true },
    { label: 'B', text: '', is_correct: false },
    { label: 'C', text: '', is_correct: false },
    { label: 'D', text: '', is_correct: false },
  ]);

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

  useEffect(() => {
    if (activeTab === 'courses') {
      loadCourses();
    } else if (activeTab === 'questions') {
      loadQuestions();
    }
  }, [activeTab, selectedCourseId, bloomFilter]);

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
      alert('Course updated successfully!');
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

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background">
      <Navbar
        title="Curriculum & Database Content Manager"
        subtitle="Update app curriculum, course learning objectives, and exit exam item banks"
        onRefresh={() => (activeTab === 'courses' ? loadCourses() : loadQuestions())}
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
            onClick={() => setActiveTab('database')}
            className={`pb-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'database'
                ? 'border-brand text-white'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Database size={16} />
            <span>Database Migrations (11)</span>
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
                  <div className="flex gap-3">
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
                    className="p-1.5 hover:bg-surface-secondary text-indigo-400 hover:text-white rounded transition-colors"
                  >
                    <Edit2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tab 2: Question Bank */}
        {activeTab === 'questions' && (
          <div className="space-y-4">
            {/* Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
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
              </div>

              <button
                onClick={() => setShowNewQuestionModal(true)}
                className="flex items-center gap-2 px-3.5 py-2 bg-brand hover:bg-brand-hover text-white text-xs font-bold rounded-lg transition-colors"
              >
                <Plus size={14} />
                <span>Author New Question</span>
              </button>
            </div>

            {/* Questions Table */}
            <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
              <div className="divide-y divide-border/60">
                {questions.length === 0 ? (
                  <div className="p-8 text-center text-sm text-slate-500">
                    No questions found for the selected course / Bloom filters.
                  </div>
                ) : (
                  questions.map((q, idx) => (
                    <div key={q.question_id} className="p-5 hover:bg-surface-secondary/40 transition-colors">
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-indigo-400">
                            {q.course_code}
                          </span>
                          <span className="text-slate-600">•</span>
                          <Badge variant="purple" size="sm">
                            {q.bloom_level}
                          </Badge>
                          <span className="text-xs text-slate-500">
                            Item #{idx + 1}
                          </span>
                        </div>
                      </div>

                      <p className="text-sm font-semibold text-white mb-3 leading-relaxed">
                        {q.question_text}
                      </p>

                      {/* Options Grid */}
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
                            <span>{opt.text}</span>
                            {opt.is_correct && (
                              <span className="ml-2 text-[10px] font-bold text-emerald-400 uppercase">
                                ✓ Correct
                              </span>
                            )}
                          </div>
                        ))}
                      </div>

                      {q.explanation && (
                        <div className="p-2.5 rounded bg-surface-secondary border border-border/80 text-xs text-slate-400">
                          <span className="font-bold text-slate-300 mr-1.5">Official Rationale:</span>
                          <span>{q.explanation}</span>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Database & Migrations */}
        {activeTab === 'database' && (
          <div className="space-y-4">
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="text-sm font-bold text-white mb-1">
                Supabase Cloud Idempotent Migrations (11 / 11 Applied)
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

        {/* Author Question Modal */}
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
                  <label className="text-xs text-slate-400 block mb-1">Question Stem</label>
                  <textarea
                    rows={3}
                    required
                    value={newQuestionText}
                    onChange={(e) => setNewQuestionText(e.target.value)}
                    placeholder="Enter the scenario or problem stem..."
                    className="w-full px-3 py-2 bg-surface-secondary border border-border rounded text-sm text-white focus:outline-none focus:border-brand"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Bloom's Taxonomy Level</label>
                    <select
                      value={newBloomLevel}
                      onChange={(e) => setNewBloomLevel(e.target.value)}
                      className="w-full px-3 py-2 bg-surface-secondary border border-border rounded text-xs text-white"
                    >
                      {['REMEMBER', 'UNDERSTAND', 'APPLY', 'ANALYSE', 'EVALUATE', 'CREATE'].map((lvl) => (
                        <option key={lvl} value={lvl}>{lvl}</option>
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

                <div className="flex justify-end gap-2 pt-2">
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
