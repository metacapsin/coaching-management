import React, { useEffect, useState } from 'react';
import { useInstitute } from '../../Context/InstituteContext';
import { useAuth } from '../../Context/AuthContext';
import { addIds, useBellMemory } from '../utils/bellMemory';
import type { Student } from '../../types';
import { fillTemplate, openWhatsApp, toLocalISODate, formatDate } from '../utils/helpers';
import { Pager } from '../ui/Pager';
import { usePaged } from '../utils/usePaged';
import { Bell, MessageSquare, Send, CheckCircle2, Edit3, Trash2 } from 'lucide-react';

export const NotificationsView: React.FC = () => {
  const {
    templates,
    updateTemplate,
    students,
    batches,
    notificationLogs,
    sendNotification,
    updateNotificationStatus,
    deleteNotification,
    profile
  } = useInstitute();

  const [activeTab, setActiveTab] = useState<'composer' | 'templates' | 'logs'>('composer');
  const [logFilter, setLogFilter] = useState<'all' | 'pending'>('all');
  const [logQuery, setLogQuery] = useState('');

  // Archived students do not get messages
  const activeStudents = students.filter(s => s.status !== 'inactive');

  // Composer State
  const [selectedTemplateId, setSelectedTemplateId] = useState(templates[0]?.id || '');
  const [audienceType, setAudienceType] = useState<'single' | 'batch' | 'defaulters' | 'all'>('single');
  const [selectedStudentId, setSelectedStudentId] = useState(activeStudents[0]?.id || '');
  const [selectedBatchId, setSelectedBatchId] = useState(batches[0]?.id || '');
  const [customBody, setCustomBody] = useState(templates[0]?.templateBody || '');
  const [dispatchSuccessMsg, setDispatchSuccessMsg] = useState('');

  // Editing a template in the library
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState('');

  const currentTemplate = templates.find(t => t.id === selectedTemplateId) || templates[0];
  const sampleStudent = activeStudents.find(s => s.id === selectedStudentId) || activeStudents[0];

  // Values for the {{tags}} of one student. Exam / schedule tags are only filled in the preview
  // with sample values; in a bulk send they are left as typed so they are easy to notice.
  const tagValues = (st: Student, withSamples: boolean): Record<string, string | number> => {
    const b = batches.find(item => item.id === st.batchId);
    const net = Math.max(0, st.totalFees - st.discount);
    const bal = Math.max(0, net - st.feePaid);
    const values: Record<string, string | number> = {
      parent_name: st.parentName,
      student_name: st.name,
      roll_no: st.rollNo,
      batch_name: b?.name || 'Class',
      date: toLocalISODate(),
      due_amount: bal.toLocaleString('en-IN'),
      due_date: st.nextDueDate ? formatDate(st.nextDueDate) : 'at the earliest',
      currency: profile.currencySymbol
    };
    if (withSamples) {
      Object.assign(values, {
        exam_name: 'Major Test 04',
        exam_date: toLocalISODate(),
        marks_obtained: 164,
        max_marks: 180,
        batch_rank: 1,
        remarks: 'Outstanding conceptual speed',
        subject: 'Physics',
        time: '05:00 PM',
        classroom: b?.classroom || 'Hall A-101',
        occasion: 'National Holiday'
      });
    }
    return values;
  };

  const messageBody = customBody || currentTemplate?.templateBody || '';

  // Live interpolated message
  const previewMessage = sampleStudent ? fillTemplate(messageBody, tagValues(sampleStudent, true)) : messageBody;

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const t = templates.find(item => item.id === templateId);
    if (t) setCustomBody(t.templateBody);
  };

  const handleDirectWhatsApp = () => {
    if (!sampleStudent || !currentTemplate) return;

    sendNotification({
      type: currentTemplate.type,
      channel: 'whatsapp',
      recipientName: sampleStudent.parentName,
      recipientPhone: sampleStudent.parentPhone,
      studentName: sampleStudent.name,
      studentId: sampleStudent.id,
      content: previewMessage,
      status: 'sent'
    });

    openWhatsApp(sampleStudent.parentPhone, previewMessage);
  };

  const handleDispatchBroadcast = () => {
    if (!currentTemplate) return;
    let targets: Student[] = [];

    if (audienceType === 'single') {
      if (sampleStudent) targets = [sampleStudent];
    } else if (audienceType === 'batch') {
      targets = activeStudents.filter(s => s.batchId === selectedBatchId);
    } else if (audienceType === 'defaulters') {
      targets = activeStudents.filter(s => Math.max(0, s.totalFees - s.discount) - s.feePaid > 0);
    } else if (audienceType === 'all') {
      targets = activeStudents;
    }

    targets.forEach(st => {
      sendNotification({
        type: currentTemplate.type,
        channel: currentTemplate.channel,
        recipientName: st.parentName,
        recipientPhone: st.parentPhone,
        studentName: st.name,
        studentId: st.id,
        content: fillTemplate(messageBody, tagValues(st, false)),
        status: 'pending'
      });
    });

    setDispatchSuccessMsg(
      targets.length === 0
        ? 'No students match this audience.'
        : `${targets.length} message${targets.length === 1 ? '' : 's'} added to the queue. Open "Message History" and press "Send now" on each one to send it from WhatsApp.`
    );
    setTimeout(() => setDispatchSuccessMsg(''), 5000);
  };

  // the lines that only the bell shows (a new student or teacher) are not messages to the parents
  const parentLogs = notificationLogs.filter(l => l.channel !== 'app');

  // A message that was not seen before gets a "New" tag while this page is open. Opening the page means seen: the number on the
  // sidebar goes away.
  const { user } = useAuth();
  const { memory, update } = useBellMemory(user?.id);
  const [freshIds, setFreshIds] = useState<string[]>([]);
  useEffect(() => {
    const unseen = notificationLogs.filter(l => l.channel !== 'app' && !memory.pageBroadcast.includes(l.id)).map(l => l.id);
    if (!unseen.length) return;
    setFreshIds(prev => addIds(prev, unseen));
    update(m => ({ ...m, pageBroadcast: addIds(m.pageBroadcast, unseen) }));
  }, [notificationLogs, memory.pageBroadcast, update]);
  const pendingLogs = parentLogs.filter(l => l.status === 'pending');
  const lq = logQuery.trim().toLowerCase();
  const shownLogs = (logFilter === 'pending' ? pendingLogs : parentLogs).filter(
    l => !lq || `${l.recipientName} ${l.studentName ?? ''} ${l.content}`.toLowerCase().includes(lq)
  );
  const pagedLogs = usePaged(shownLogs, 20, logFilter + lq);

  const sendNow = (id: string) => {
    const log = notificationLogs.find(l => l.id === id);
    if (!log) return;
    openWhatsApp(log.recipientPhone, log.content);
    updateNotificationStatus(id, 'sent');
  };

  const startEditing = (id: string, body: string) => {
    setEditingTemplateId(id);
    setEditBody(body);
  };

  const saveTemplate = () => {
    if (!editingTemplateId || !editBody.trim()) return;
    updateTemplate(editingTemplateId, editBody.trim());
    if (editingTemplateId === selectedTemplateId) setCustomBody(editBody.trim());
    setEditingTemplateId(null);
  };

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-amber-500 text-white">
              <Bell className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Parent Notifications & Broadcast Center</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Automated attendance alerts, fee reminders, exam scorecards, and general broadcast notifications with WhatsApp/SMS integration.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('composer')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              activeTab === 'composer' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Dispatch Composer
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              activeTab === 'templates' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Templates ({templates.length})
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              activeTab === 'logs' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Audit Logs ({parentLogs.length})
          </button>
        </div>
      </div>

      {/* Tab 1: Dispatch Composer */}
      {activeTab === 'composer' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Message Configuration Form */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider text-xs border-b border-slate-100 pb-2">
              1. Broadcast Configuration
            </h3>

            {/* Template Selector */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Select Notification Flow Template
              </label>
              <select
                value={selectedTemplateId}
                onChange={e => handleTemplateSelect(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {templates.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.title} ({t.channel.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>

            {/* Target Audience */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Target Parent Audience
              </label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setAudienceType('single')}
                  className={`p-2.5 rounded-lg border text-left transition-all ${
                    audienceType === 'single'
                      ? 'border-blue-600 bg-blue-50/60 font-semibold text-blue-900 ring-1 ring-blue-600/20'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  Specific Student Parent
                </button>
                <button
                  type="button"
                  onClick={() => setAudienceType('batch')}
                  className={`p-2.5 rounded-lg border text-left transition-all ${
                    audienceType === 'batch'
                      ? 'border-blue-600 bg-blue-50/60 font-semibold text-blue-900 ring-1 ring-blue-600/20'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  Entire Batch Parents
                </button>
                <button
                  type="button"
                  onClick={() => setAudienceType('defaulters')}
                  className={`p-2.5 rounded-lg border text-left transition-all ${
                    audienceType === 'defaulters'
                      ? 'border-blue-600 bg-blue-50/60 font-semibold text-blue-900 ring-1 ring-blue-600/20'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  All Fee Defaulters
                </button>
                <button
                  type="button"
                  onClick={() => setAudienceType('all')}
                  className={`p-2.5 rounded-lg border text-left transition-all ${
                    audienceType === 'all'
                      ? 'border-blue-600 bg-blue-50/60 font-semibold text-blue-900 ring-1 ring-blue-600/20'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  All Academy Parents
                </button>
              </div>
            </div>

            {/* Audience specific dropdown */}
            {audienceType === 'single' && (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Select Candidate</label>
                <select
                  value={selectedStudentId}
                  onChange={e => setSelectedStudentId(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  {activeStudents.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.rollNo}) — Parent: {s.parentName} ({s.parentPhone})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {audienceType === 'batch' && (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Select Batch</label>
                <select
                  value={selectedBatchId}
                  onChange={e => setSelectedBatchId(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  {batches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Message Body Input */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-medium text-slate-700">Message Content</label>
                <span className="text-[10px] text-slate-400">Supports variable tags</span>
              </div>
              <textarea
                rows={5}
                value={customBody}
                onChange={e => setCustomBody(e.target.value)}
                className="w-full p-3 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-sans leading-relaxed"
              />
            </div>

            {/* Tags Pills */}
            <div className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              <span className="font-semibold text-slate-700 block mb-1">Available Tags:</span>
              <div className="flex flex-wrap gap-1 font-mono text-[10px]">
                {['{{parent_name}}', '{{student_name}}', '{{roll_no}}', '{{batch_name}}', '{{due_amount}}', '{{due_date}}', '{{date}}'].map(tag => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setCustomBody(prev => `${prev} ${tag}`)}
                    className="px-1.5 py-0.5 bg-white border border-slate-200 rounded hover:bg-slate-100 text-slate-700"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            {dispatchSuccessMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{dispatchSuccessMsg}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="pt-2 flex items-center gap-2">
              {audienceType === 'single' && (
                <button
                  type="button"
                  onClick={handleDirectWhatsApp}
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  Launch WhatsApp to Parent
                </button>
              )}

              <button
                type="button"
                onClick={handleDispatchBroadcast}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
              >
                <Send className="w-3.5 h-3.5" />
                Record Broadcast in Log
              </button>
            </div>
          </div>

          {/* Right: Live Simulated Mobile Preview */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider text-xs px-1">
              2. Live Recipient Device Preview
            </h3>

            <div className="bg-slate-900 rounded-2xl p-4 shadow-xl max-w-sm mx-auto text-slate-100 border-4 border-slate-800">
              {/* Fake Phone Header */}
              <div className="flex justify-between items-center text-[11px] text-slate-400 pb-2 border-b border-slate-800 mb-3">
                <span className="font-semibold text-slate-200">Apex Academy Portal</span>
                <span>WhatsApp Gateway</span>
              </div>

              {/* Chat Bubble Container */}
              <div className="bg-[#0b141a] rounded-xl p-3 min-h-64 flex flex-col justify-end space-y-3">
                {/* Simulated Outgoing Message Bubble */}
                <div className="bg-[#005c4b] text-[#e9edef] p-3 rounded-xl rounded-tr-none text-xs leading-relaxed shadow-sm relative ml-6">
                  <p className="whitespace-pre-wrap">{previewMessage}</p>
                  <div className="flex justify-end items-center gap-1 mt-2 text-[10px] text-[#8696a0]">
                    <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    <span>✓✓</span>
                  </div>
                </div>
              </div>

              <div className="mt-3 text-[11px] text-slate-400 text-center">
                Recipient: <strong className="text-white">{sampleStudent?.parentName}</strong> ({sampleStudent?.parentPhone})
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Templates Library */}
      {activeTab === 'templates' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {templates.map(tpl => (
              <div key={tpl.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">{tpl.title}</h4>
                    <span className="text-[11px] text-slate-500 uppercase font-mono">{tpl.channel} · {tpl.type}</span>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedTemplateId(tpl.id);
                      setCustomBody(tpl.templateBody);
                      setActiveTab('composer');
                    }}
                    className="px-2.5 py-1 text-xs text-blue-600 hover:bg-blue-50 border border-blue-200 rounded-md transition-colors"
                  >
                    Use in Composer
                  </button>
                </div>

                {editingTemplateId === tpl.id ? (
                  <div className="space-y-2">
                    <textarea
                      rows={5}
                      value={editBody}
                      onChange={e => setEditBody(e.target.value)}
                      className="w-full p-3 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setEditingTemplateId(null)}
                        className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={saveTemplate}
                        className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
                      >
                        Save Template
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-xs text-slate-700 leading-relaxed font-sans">
                    {tpl.templateBody}
                    <button
                      onClick={() => startEditing(tpl.id, tpl.templateBody)}
                      className="mt-2 flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:underline"
                    >
                      <Edit3 className="w-3 h-3" />
                      Edit text
                    </button>
                  </div>
                )}

                <div className="text-[10px] text-slate-400">
                  Tags: {tpl.availableTags.map(t => `{{${t}}}`).join(', ')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Notification Audit Logs */}
      {activeTab === 'logs' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
            <h3 className="text-sm font-semibold text-slate-900">
              Notification Gateway Dispatch History ({parentLogs.length})
            </h3>
            <div className="flex items-center gap-2">
              <input
              value={logQuery}
              onChange={e => setLogQuery(e.target.value)}
              placeholder="Search messages..."
              className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white w-44 sm:w-56"
            />
              <select
                value={logFilter}
                onChange={e => setLogFilter(e.target.value as 'all' | 'pending')}
                className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
              >
                <option value="all">All messages</option>
                <option value="pending">Waiting to be sent ({pendingLogs.length})</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase">
                <tr>
                  <th className="p-3.5">Timestamp</th>
                  <th className="p-3.5">Recipient & Contact</th>
                  <th className="p-3.5">Student</th>
                  <th className="p-3.5">Channel / Type</th>
                  <th className="p-3.5">Message Content</th>
                  <th className="p-3.5 text-right">Status</th>
                  <th className="p-3.5 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pagedLogs.items.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-3.5 font-mono text-slate-400 whitespace-nowrap">
                      {freshIds.includes(log.id) && <span className="mr-1.5 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-rose-600 text-white font-sans">New</span>}
                      {log.timestamp}
                    </td>

                    <td className="p-3.5">
                      <span className="font-semibold text-slate-900 block">{log.recipientName}</span>
                      <span className="font-mono text-[11px] text-slate-500">{log.recipientPhone}</span>
                    </td>

                    <td className="p-3.5 font-medium text-slate-800">
                      {log.studentName}
                    </td>

                    <td className="p-3.5">
                      <span className="font-semibold text-slate-800 uppercase text-[10px] block">
                        {log.channel}
                      </span>
                      <span className="text-[11px] text-slate-400 capitalize">
                        {log.type.replace(/_/g, ' ')}
                      </span>
                    </td>

                    <td className="p-3.5 text-slate-600 max-w-sm truncate">
                      {log.content}
                    </td>

                    <td className="p-3.5 text-right">
                      {log.status === 'pending' ? (
                        <button
                          onClick={() => sendNow(log.id)}
                          className="px-2.5 py-1 text-[11px] font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md inline-flex items-center gap-1"
                        >
                          <Send className="w-3 h-3" />
                          Send now
                        </button>
                      ) : (
                        <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded capitalize">
                          {log.status === 'sent' ? 'Sent' : log.status}
                        </span>
                      )}
                    </td>

                    <td className="p-3.5 text-right">
                      <button
                        onClick={() => deleteNotification(log.id)}
                        aria-label="Delete this message"
                        title="Delete this message"
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {shownLogs.length === 0 && <p className="p-8 text-center text-xs text-slate-400">No messages here.</p>}
          <Pager {...pagedLogs} onPage={pagedLogs.setPage} />
        </div>
      )}
    </div>
  );
};
