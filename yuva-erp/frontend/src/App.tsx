/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Fragment, useEffect, useRef, useState } from 'react';
import { InstituteProvider, useInstitute } from './Context/InstituteContext';
import { AuthProvider, useAuth, roleLabel, accountLabel } from './Context/AuthContext';
import { canAccessTab, canManageInstitute } from './Context/Access';
import { useLang } from './i18n/LangContext';
import type { TabId } from './Context/Access';
import { useSyncStatus } from './components/utils/api';
import { useBellMemory } from './components/utils/bellMemory';
import { tabPath, useTabRoute } from './components/utils/useTabRoute';

import { DashboardView } from './components/views/DashboardView';
import { AdmissionsView } from './components/views/AdmissionsView';
import { AttendanceView } from './components/views/AttendanceView';
import { AttendanceHistoryView } from './components/views/AttendanceHistoryView';
import { FeesView } from './components/views/FeesView';
import { ExamsView } from './components/views/ExamsView';
import { BatchesTimetableView } from './components/views/BatchesTimetableView';
import { NotificationsView } from './components/views/NotificationsView';
import { SettingsView } from './components/views/SettingsView';
import { EnquiriesView } from './components/views/EnquiriesView';
import { NoticesView } from './components/views/NoticesView';
import { MaterialView } from './components/views/MaterialView';
import { LeavePage } from './components/views/LeavePage';
import { MailBanner } from './components/layout/MailBanner';
import { ReportsView } from './components/views/ReportsView';
import { ExpensesView } from './components/views/ExpensesView';
import { LibraryView } from './components/views/LibraryView';
import { TeamView } from './components/views/Teamview';
import { StudentPortalView } from './components/views/Studentportalview';
import { TeacherHomeView } from './components/views/Teacherhomeview';

// Auth + layout
import { SuperAdminApp } from './components/super/SuperAdminApp';
import { LandingPage } from './components/landing/LandingPage';
import { PayPage } from './components/pay/PayPage';
import { ParentLoginPage } from './components/auth/ParentLoginPage';
import { PublicRulesPage } from './components/landing/PublicRulesPage';
import { ForcePasswordChange } from './components/auth/ForcePasswordChange';
import { RulesGate } from './components/auth/RulesGate';
import { RulesView } from './components/views/RulesView';
import { OrgLogo } from './components/ui/OrgLogo';
import { Navbar } from './components/layout/Navbar';
import { ConnectionScreen } from './components/layout/ConnectionScreen';

// Modals
import { AdmissionModal } from './components/modals/AdmissionModal';
import { RecordPaymentModal } from './components/modals/RecordPaymentModal';
import { PrintableFeeReceiptModal } from './components/modals/PrintableFeeReceiptModal';
import { StudentDetailModal } from './components/modals/StudentDetailModal';

import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  CreditCard,
  Award,
  Layers,
  Bell,
  Settings,
  UserPlus,
  Menu,
  X,
  LogOut,
  ShieldCheck,
  PhoneCall,
  Megaphone,
  BookOpen,
  BarChart3,
  Wallet,
  Library,
  ScrollText,
  CalendarOff
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { FeeTransaction, Student } from './types';

function MainApp() {
  const { profile, students, transactions, notificationLogs, announcements, leaveRequests } = useInstitute();
  const { user, signOut } = useAuth();
  // the number on the sidebar: what is new on the Notice Board (it goes away when the page is opened)
  const { memory: bellMemory } = useBellMemory(user?.id);
  const activityLogs =
    user?.role === 'admin'
      ? notificationLogs.filter(l => l.channel === 'app')
      : user?.role === 'teacher'
      ? notificationLogs.filter(l => l.type === 'new_student')
      : user?.role === 'student' && user.isParent
      ? notificationLogs.filter(l => l.channel !== 'app' && l.channel !== 'student') // the messages of the coaching about the child
      : user?.role === 'student'
      ? notificationLogs.filter(l => l.channel === 'student') // homework and tests, written for the student
      : [];
  const newNotices =
    announcements.filter(a => a.authorId !== user?.id && !bellMemory.pageNotices.includes(a.id)).length +
    activityLogs.filter(l => !bellMemory.pageNotices.includes(l.id)).length +
    (user?.role === 'admin' ? leaveRequests.filter(l => l.status === 'pending' && !bellMemory.pageNotices.includes(`leave-${l.id}`)).length : 0); // a student asks for leave
  const { t } = useLang();

  const role = user?.role;
  const syncStatus = useSyncStatus();
  const isManager = canManageInstitute(role);

  // each page has its own address (/fees, /attendance...): a reload stays on it and the Back button works
  // (a parent has no Library: it is for the principal, the teachers and the students)
  const mayOpen = (tab: Parameters<typeof canAccessTab>[1]) => canAccessTab(role, tab) && !(tab === 'library' && user?.isParent);
  const [activeTab, setActiveTab] = useTabRoute(tab => mayOpen(tab));
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  // each press on an "Add Teacher" button opens the Add Account window in Team & Access
  const [addTeacherSignal, setAddTeacherSignal] = useState(0);
  // the last press of an Add Teacher button that the Team page already answered (the Team page opens the form once for each press, not again each time it is opened)
  const handledTeacherSignal = useRef(0);
  const openAddTeacher = () => {
    setActiveTab('team');
    setAddTeacherSignal(n => n + 1);
  };

  // Modal states
  const [isAdmissionModalOpen, setIsAdmissionModalOpen] = useState(false);
  const [isRecordPaymentModalOpen, setIsRecordPaymentModalOpen] = useState(false);
  const [preselectedPaymentStudentId, setPreselectedPaymentStudentId] = useState<string | undefined>(undefined);

  const [receiptModalTx, setReceiptModalTx] = useState<FeeTransaction | null>(null);
  const [receiptAutoSend, setReceiptAutoSend] = useState(false); // the form asked to email the receipt (PDF) to the parent
  const [detailModalStudent, setDetailModalStudent] = useState<Student | null>(null);

  // Global admission success banner
  const [recentEnrolledName, setRecentEnrolledName] = useState<string | null>(null);

  const handleOpenPaymentForStudent = (studentId: string) => {
    setPreselectedPaymentStudentId(studentId);
    setIsRecordPaymentModalOpen(true);
  };

  const handleSelectStudent = (studentId: string) => {
    const st = students.find(s => s.id === studentId);
    if (st) setDetailModalStudent(st);
  };

  const handleViewReceipt = (txId: string) => {
    const tx = transactions.find(t => t.id === txId);
    setReceiptAutoSend(false);
    if (tx) setReceiptModalTx(tx);
  };

  const handlePaymentSuccess = (tx: FeeTransaction, options?: { emailToParent: boolean }) => {
    setReceiptAutoSend(!!options?.emailToParent);
    setReceiptModalTx(tx);
  };

  const dashboardLabel =
    user?.isParent ? 'Parent Portal' : role === 'student' ? 'My Portal' : role === 'teacher' ? 'My Dashboard' : 'Dashboard';

  const NAV_GROUP: Record<string, 'main' | 'learn' | 'manage'> = {
    dashboard: 'main', students: 'main', enquiries: 'main', attendance: 'main', fees: 'main', exams: 'main', batches: 'main',
    notifications: 'learn', notices: 'learn', material: 'learn', leave: 'learn', library: 'learn',
    rules: 'manage', reports: 'manage', expenses: 'manage', team: 'manage', settings: 'manage'
  };
  const NAV_GROUP_LABEL = { main: 'Main menu', learn: 'Learning & notices', manage: 'Management' } as const;

  const navItems: { id: TabId; label: string; icon: LucideIcon; badge?: number; fresh?: boolean }[] = [
    { id: 'dashboard', label: dashboardLabel, icon: LayoutDashboard },
    { id: 'students', label: 'Admissions & Students', icon: Users },
    { id: 'enquiries', label: 'Enquiries', icon: PhoneCall },
    { id: 'attendance', label: role === 'admin' ? 'Attendance History' : 'Daily Attendance', icon: CalendarCheck },
    { id: 'fees', label: 'Fees & Invoicing', icon: CreditCard },
    { id: 'exams', label: role === 'teacher' ? 'Tests & Marks' : 'Exams & Results', icon: Award },
    { id: 'batches', label: 'Batches & Timetable', icon: Layers },
    { id: 'notifications', label: 'Parent Broadcasts', icon: Bell },
    { id: 'notices', label: 'Notice Board', icon: Megaphone, badge: newNotices, fresh: true },
    { id: 'material', label: role === 'student' ? 'Study Material' : 'Study Material & Homework', icon: BookOpen },
    { id: 'leave', label: 'Apply for Leave', icon: CalendarOff },
    { id: 'library', label: 'Library', icon: Library },
    { id: 'rules', label: 'Rules & Regulations', icon: ScrollText },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
    { id: 'expenses', label: 'Expenses & Profit', icon: Wallet },
    { id: 'team', label: role === 'admin' ? 'Team & Access' : 'My Account', icon: ShieldCheck },
    { id: 'settings', label: 'Institute Profile', icon: Settings }
  ];

  // Each role sees only the pages it is allowed to open
  const visibleNavItems = navItems.filter(item => mayOpen(item.id) && !(item.id === 'leave' && user?.isParent)); // a parent has no leave to ask

  // the name of the open page is in the title of the browser tab
  const pageName = navItems.find(item => item.id === activeTab)?.label ?? 'Dashboard';
  useEffect(() => {
    document.title = `${pageName} · ${profile.name}`;
    return () => {
      document.title = 'AcademiaOS - Coaching Institute Management SaaS';
    };
  }, [pageName, profile.name]);

  const renderTab = () => {
    if (!mayOpen(activeTab)) {
      return (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-xs">
          <ShieldCheck className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h2 className="text-base font-semibold text-slate-900">You do not have access to this page</h2>
          <p className="text-xs text-slate-500 mt-1">
            Your role ({roleLabel(role)}) cannot open this section.
          </p>
        </div>
      );
    }

    switch (activeTab) {
      case 'dashboard':
        if (role === 'student') return <StudentPortalView onNavigate={tab => setActiveTab(tab as TabId)} />;
        if (role === 'teacher') return <TeacherHomeView onNavigate={tab => setActiveTab(tab as TabId)} />;
        return (
          <DashboardView
            onNavigate={tab => setActiveTab(tab as TabId)}
            onOpenAdmission={() => setIsAdmissionModalOpen(true)}
            onOpenRecordPayment={() => {
              setPreselectedPaymentStudentId(undefined);
              setIsRecordPaymentModalOpen(true);
            }}
            onSelectStudent={handleSelectStudent}
            onViewReceipt={handleViewReceipt}
            onCollectPayment={handleOpenPaymentForStudent}
            onAddTeacher={role === 'admin' ? openAddTeacher : undefined}
          />
        );
      case 'students':
        return (
          <AdmissionsView
            onOpenAdmission={() => setIsAdmissionModalOpen(true)}
            onSelectStudent={handleSelectStudent}
          />
        );
      case 'attendance':
        // the teachers mark the attendance (each the own subject); the principal sees the history
        return role === 'admin' ? <AttendanceHistoryView /> : <AttendanceView />;
      case 'fees':
        return (
          <FeesView
            onOpenRecordPayment={() => {
              setPreselectedPaymentStudentId(undefined);
              setIsRecordPaymentModalOpen(true);
            }}
            onViewReceipt={handleViewReceipt}
            onSelectStudent={handleSelectStudent}
            onCollectPayment={handleOpenPaymentForStudent}
          />
        );
      case 'exams':
        return <ExamsView />;
      case 'batches':
        return <BatchesTimetableView />;
      case 'notifications':
        return <NotificationsView />;
      case 'enquiries':
        return <EnquiriesView />;
      case 'notices':
        return <NoticesView />;
      case 'material':
        return <MaterialView />;
      case 'leave':
        return <LeavePage />;
      case 'reports':
        return <ReportsView />;
      case 'expenses':
        return <ExpensesView />;
      case 'library':
        return <LibraryView />;
      case 'rules':
        return <RulesView />;
      case 'team':
        return <TeamView addTeacherSignal={addTeacherSignal} handledSignal={handledTeacherSignal} />;
      case 'settings':
        return <SettingsView />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#ffffff] dark:bg-[#0f172a] flex flex-col md:flex-row text-slate-900 font-sans antialiased">
      {/* Mobile Top Header (hidden on print) */}
      <div className="md:hidden bg-[#f8fafc] dark:bg-[#080f1e] text-slate-900 px-4 py-3 flex items-center justify-between border-b border-slate-200 print:hidden">
        <div className="flex items-center gap-2">
          <OrgLogo className="w-7 h-7 rounded-lg" fallbackClass="bg-blue-600 text-white font-bold text-xs" />
          <div>
            <div className="text-sm font-bold truncate max-w-48 leading-tight">{profile.name}</div>
            <div className="text-[10px] text-slate-500">Session {profile.academicYear}</div>
          </div>
        </div>

        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Sidebar Navigation (hidden on print) */}
      <aside
        className={`fixed md:sticky top-0 h-screen z-40 w-64 bg-[#f8fafc] dark:bg-[#080f1e] text-slate-700 border-r border-slate-200 flex flex-col justify-between shrink-0 transition-transform duration-200 print:hidden ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="flex-1 min-h-0 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {/* Brand Header */}
          <div className="px-5 py-[clamp(6px,1.8vh,20px)] border-b border-slate-200">
            <div className="flex items-center gap-2.5">
              <OrgLogo className="w-8 h-8 rounded-lg shadow-sm" fallbackClass="bg-blue-600 text-white font-black text-sm" />
              <div className="overflow-hidden">
                <h1 className="text-sm font-bold text-slate-900 tracking-tight truncate leading-tight">
                  {profile.name}
                </h1>
                <p className="text-[10px] text-slate-500 font-medium truncate mt-0.5">
                  Academic Session {profile.academicYear}
                </p>
              </div>
            </div>
          </div>

          {/* Quick Action Button (office only) */}
          {isManager && (
            <div className="px-4 py-[clamp(6px,1.2vh,12px)] border-b border-slate-200">
              <button
                onClick={() => {
                  setIsAdmissionModalOpen(true);
                  setMobileMenuOpen(false);
                }}
                className="w-full px-3 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2"
              >
                <UserPlus className="w-3.5 h-3.5" />
                New Student Admission
              </button>
            </div>
          )}

          {/* Nav List */}
          <nav className="px-3 py-[clamp(4px,1vh,12px)] space-y-[clamp(0px,0.3vh,4px)]">
            {visibleNavItems.map((item, index) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              // a small heading where a new group of pages begins (Main menu, Learning and notices, Management)
              const group = NAV_GROUP[item.id] ?? 'main';
              const heading = index === 0 || (NAV_GROUP[visibleNavItems[index - 1].id] ?? 'main') !== group ? NAV_GROUP_LABEL[group] : null;

              return (
                <Fragment key={item.id}>
                {heading && <p className={`px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400 ${index === 0 ? 'pt-0.5' : 'pt-[clamp(4px,1.2vh,12px)]'}`}>{heading}</p>}
                <a
                  href={tabPath(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={e => {
                    // a normal click opens the page here; Ctrl / Shift / middle click open it the browser's way (a new tab)
                    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                    e.preventDefault();
                    setActiveTab(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`relative w-full px-3 h-[clamp(19px,3.5vh,38px)] text-xs font-medium rounded-lg flex items-center justify-between transition-colors ${
                    isActive
                      ? 'bg-orange-100 text-orange-700 dark:bg-[#7c2d12] dark:text-orange-300 font-semibold'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  {isActive && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-orange-500" />}
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-orange-600 dark:text-orange-300' : 'text-slate-500'}`} />
                    <span>{t(item.label)}</span>
                  </div>

                  {(isManager || item.fresh) && typeof item.badge === 'number' && item.badge > 0 && (
                    <span
                      className={`font-mono text-[10px] px-1.5 py-0.2 rounded font-medium ${
                        item.fresh ? 'bg-rose-600 text-white font-bold' : 'bg-slate-200 text-slate-700'
                      }`}
                      title={item.fresh ? 'New' : undefined}
                    >
                      {item.badge}
                    </span>
                  )}
                </a>
                </Fragment>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="shrink-0 px-4 py-[clamp(8px,1.6vh,16px)] border-t border-slate-200 text-[11px] text-slate-500 space-y-[clamp(4px,1vh,12px)]">
          {/* Signed-in user + Sign Out */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-8 h-8 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                {(user?.name || 'U').slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-900 truncate">{user?.name}</div>
                <div className="text-[10px] text-slate-500 truncate">{accountLabel(user)}</div>
              </div>
            </div>
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                signOut();
              }}
              title="Sign Out"
              className="p-2 rounded-lg text-slate-500 hover:text-rose-500 hover:bg-slate-100 transition-colors shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

          <div className="flex justify-between items-center text-slate-500 text-[10px] [@media(max-height:760px)]:hidden">
            <span>COACHING SAAS v2.4</span>
            <span className="text-emerald-500 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {syncStatus === 'connected' ? 'Connected to server' : 'Server not reachable'}
            </span>
          </div>
          <p className="text-slate-500 truncate font-medium [@media(max-height:860px)]:hidden">{profile.address}</p>
        </div>
      </aside>

      {/* Right side: Top Navbar + Main Content */}
      <div className="flex-1 min-w-0 flex flex-col">
        <Navbar
          activeTab={activeTab}
          onNavigate={setActiveTab}
          onOpenAdmission={() => setIsAdmissionModalOpen(true)}
          onAddTeacher={openAddTeacher}
          onSelectStudent={handleSelectStudent}
        />

        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          {/* Global Toast / Success Banner */}
          {recentEnrolledName && (
            <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex justify-between items-center shadow-xs">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>
                  Student <strong>{recentEnrolledName}</strong> has been successfully admitted and assigned to batch!
                </span>
              </div>
              <button
                onClick={() => setRecentEnrolledName(null)}
                className="text-emerald-700 hover:underline font-medium"
              >
                Dismiss
              </button>
            </div>
          )}

          {role === 'admin' && activeTab !== 'settings' && <MailBanner onConnect={() => setActiveTab('settings')} />}

          {renderTab()}
        </main>
      </div>

      {/* Global Modals (opened only from office pages) */}
      {isAdmissionModalOpen && (
        <AdmissionModal
          isOpen={isAdmissionModalOpen}
          onClose={() => setIsAdmissionModalOpen(false)}
          onSuccess={name => {
            setRecentEnrolledName(name);
            setTimeout(() => setRecentEnrolledName(null), 6000);
          }}
        />
      )}

      {isRecordPaymentModalOpen && (
        <RecordPaymentModal
          isOpen={isRecordPaymentModalOpen}
          preselectedStudentId={preselectedPaymentStudentId}
          onClose={() => setIsRecordPaymentModalOpen(false)}
          onPaymentSuccess={handlePaymentSuccess}
        />
      )}

      <PrintableFeeReceiptModal transaction={receiptModalTx} onClose={() => setReceiptModalTx(null)} autoSend={receiptAutoSend} />

      <StudentDetailModal
        student={detailModalStudent}
        onClose={() => setDetailModalStudent(null)}
        onCollectPayment={stId => {
          setDetailModalStudent(null);
          handleOpenPaymentForStudent(stId);
        }}
        onViewReceipt={txId => {
          setDetailModalStudent(null);
          handleViewReceipt(txId);
        }}
      />
    </div>
  );
}

// Shows the login page until a user is signed in. The server sends each role only its own data.
function AuthGate() {
  const { user, ready, serverError, retryConnection, signOut } = useAuth();

  // A link from an email (/?portal=super, /?portal=admin...) is meant for signing in. Somebody who is already signed in
  // (for example the Super Admin on the same computer) still sees the sign in page first, with a note, and not the app.
  const [fromLink, setFromLink] = useState(() => new URLSearchParams(window.location.search).has('portal'));
  const [seenId, setSeenId] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    if (ready && seenId === undefined) setSeenId(user?.id ?? null);
  }, [ready, user, seenId]);
  const leaveLink = () => {
    setFromLink(false);
    window.history.replaceState(null, '', window.location.pathname);
  };
  // somebody signed in through the form: the link has done its work
  useEffect(() => {
    if (fromLink && seenId !== undefined && user && user.id !== seenId) {
      setFromLink(false);
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, [fromLink, seenId, user]);

  // signed out: the address of a page of the app is no more (the website is at "/")
  useEffect(() => {
    if (ready && !user && window.location.pathname !== '/' && window.location.pathname !== '/parent' && !window.location.pathname.startsWith('/rules/')) window.history.replaceState(null, '', '/');
  }, [ready, user]);

  if (serverError) return <ConnectionScreen error={serverError} onRetry={retryConnection} />;
  if (!ready) return <ConnectionScreen />;
  // The website is the first page; the sign in form is in its top part
  if (!user) {
    if (window.location.pathname === '/parent') return <ParentLoginPage />;
    if (window.location.pathname.startsWith('/rules/')) return <PublicRulesPage orgId={decodeURIComponent(window.location.pathname.slice('/rules/'.length))} />;
    return <LandingPage />;
  }
  if (fromLink && seenId === user.id) {
    return (
      <LandingPage
        signedIn={{
          text: `${user.name} (${roleLabel(user.role)})`,
          onContinue: leaveLink,
          onSignOut: () => {
            void signOut();
          }
        }}
      />
    );
  }
  // somebody else set this password: choose an own one before anything else
  if (user.mustChangePassword) return <ForcePasswordChange />;
  // a new teacher: the rules and regulations of the coaching are read and agreed to before the app opens
  if ((user.role === 'teacher' || user.role === 'student') && user.mustAcceptRules) return <RulesGate />;
  // the Super Admin signed in on the same login page: the list of coachings instead of a coaching
  if (user.role === 'super') return <SuperAdminApp />;

  return (
    <InstituteProvider>
      <MainApp />
    </InstituteProvider>
  );
}

export default function App() {
  // the page of a parent from a fee notice: no sign in, no app
  if (window.location.pathname === '/pay') return <PayPage />;
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}