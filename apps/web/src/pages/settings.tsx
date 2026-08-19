import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Tabs from '@radix-ui/react-tabs';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Monitor,
  Moon,
  Sun,
  Download,
  UserCog,
  Bell,
  Database,
  ShieldAlert,
  Check,
  Loader2,
  Settings,
} from 'lucide-react';
import { changePasswordBodySchema, type ChangePasswordBody } from '@mathitis/schemas';
import { useAuth } from '@/contexts/auth-context';
import { useTheme, type ThemePreference } from '@/contexts/theme-context';
import { useNotifications } from '@/contexts/notifications-context';
import { settingsApi } from '@/lib/settings-api';
import { requestsApi } from '@/lib/requests-api';
import { ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { FieldError, Input } from '@/components/ui/input';
import { ThemeToggle } from '@/components/ui/theme-toggle';

interface AnonymizeForm {
  password: string;
}

export function SettingsPage() {
  const { user, logout } = useAuth();
  const { theme, preference, setPreference } = useTheme();
  const { muted, toggleMuted } = useNotifications();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState('account');
  const [semester, setSemester] = useState<number>(user?.semester ?? 1);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(!muted);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const prefsAppliedRef = useRef(false);

  const [pwdError, setPwdError] = useState<string | null>(null);
  const [pwdSuccess, setPwdSuccess] = useState(false);

  const [anonymizeOpen, setAnonymizeOpen] = useState(false);
  const [anonymizeError, setAnonymizeError] = useState<string | null>(null);

  const [notice, setNotice] = useState<string | null>(null);

  const settingsQuery = useQuery({
    queryKey: ['account', 'settings'],
    queryFn: () => settingsApi.get(),
    enabled: Boolean(user),
  });

  useEffect(() => {
    if (!settingsQuery.data || prefsAppliedRef.current) return;
    const prefs = settingsQuery.data.preferences;
    setSemester(settingsQuery.data.semester);
    setReducedMotion(Boolean(prefs?.reducedMotion));
    setHighContrast(Boolean((prefs as { highContrast?: boolean } | null)?.highContrast));
    setSoundEnabled(prefs?.soundEnabled ?? !muted);
    setEmailNotifications(prefs?.emailNotifications ?? true);
    if (prefs?.theme) setPreference(prefs.theme);
    prefsAppliedRef.current = true;
  }, [settingsQuery.data]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('reduced-motion', reducedMotion);
    root.classList.toggle('high-contrast', highContrast);
  }, [reducedMotion, highContrast]);

  const requestsQuery = useQuery({
    queryKey: ['requests', 'settings'],
    queryFn: () =>
      requestsApi
        .list({ inbox: user?.role === 'freshman' ? 'sent' : 'incoming' })
        .then((r) => r.requests),
    enabled: Boolean(user),
  });

  const activeMentorships =
    requestsQuery.data?.filter((r) => r.status === 'accepted').length ?? 0;

  const updateMutation = useMutation({
    mutationFn: (patch: {
      semester?: number;
      preferences?: {
        theme?: ThemePreference;
        reducedMotion?: boolean;
        soundEnabled?: boolean;
        emailNotifications?: boolean;
      };
    }) => settingsApi.updateAccount(patch),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['account', 'settings'] });
      void queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      void queryClient.invalidateQueries({ queryKey: ['profile', 'me'] });
      setNotice('Preferences saved.');
    },
    onError: () => {
      setNotice('Could not save your preferences. Please try again.');
    },
  });

  const handleSemesterChange = (next: number) => {
    setSemester(next);
    updateMutation.mutate({ semester: next });
  };

  const handleThemeChange = (next: ThemePreference) => {
    setPreference(next);
    updateMutation.mutate({ preferences: { theme: next } });
  };

  const handleReducedMotion = () => {
    const next = !reducedMotion;
    setReducedMotion(next);
    updateMutation.mutate({ preferences: { reducedMotion: next } });
  };

  const handleHighContrast = () => {
    const next = !highContrast;
    setHighContrast(next);
    updateMutation.mutate({
      preferences: { highContrast: next } as { theme?: ThemePreference; reducedMotion?: boolean; soundEnabled?: boolean; emailNotifications?: boolean },
    });
  };

  const handleSoundToggle = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    if (next !== muted) toggleMuted();
    updateMutation.mutate({ preferences: { soundEnabled: next } });
  };

  const handleEmailNotifications = () => {
    const next = !emailNotifications;
    setEmailNotifications(next);
    updateMutation.mutate({ preferences: { emailNotifications: next } });
  };

  const changePasswordMutation = useMutation({
    mutationFn: (input: ChangePasswordBody) => settingsApi.changePassword(input),
    onSuccess: () => {
      setPwdSuccess(true);
      setPwdError(null);
      resetPwd();
    },
    onError: (err: unknown) => {
      setPwdError(err instanceof ApiError ? err.message : 'Unable to change password.');
    },
  });

  const anonymizeMutation = useMutation({
    mutationFn: (input: AnonymizeForm) => settingsApi.anonymize(input),
    onSuccess: async () => {
      await logout();
    },
    onError: (err: unknown) => {
      setAnonymizeError(err instanceof ApiError ? err.message : 'Unable to anonymize account.');
    },
  });

  const {
    register: registerPwd,
    handleSubmit: handlePwdSubmit,
    reset: resetPwd,
    formState: { errors: pwdErrors, isSubmitting: pwdSubmitting },
  } = useForm<ChangePasswordBody>({
    resolver: zodResolver(changePasswordBodySchema),
    defaultValues: { currentPassword: '', newPassword: '' },
  });

  const {
    register: registerAnon,
    handleSubmit: handleAnonSubmit,
    formState: { errors: anonErrors },
  } = useForm<AnonymizeForm>({
    defaultValues: { password: '' },
  });

  const onAnonymizeSubmit = handleAnonSubmit(async (values) => {
    setAnonymizeError(null);
    await anonymizeMutation.mutateAsync(values);
  });

  const onPwdSubmit = handlePwdSubmit(async (values) => {
    setPwdError(null);
    setPwdSuccess(false);
    await changePasswordMutation.mutateAsync(values);
  });

  const handleDownload = async () => {
    setNotice(null);
    try {
      const data = await settingsApi.exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'mathitis-data-export.json';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setNotice('Your data export has been downloaded.');
    } catch {
      setNotice('Could not export your data. Please try again.');
    }
  };

  const email = settingsQuery.data?.email ?? user?.email ?? '';
  const emailDomain = email.includes('@') ? email.slice(email.indexOf('@') + 1) : '';

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background">
      <div className="mx-auto w-full max-w-4xl px-4 py-8">
        <header className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Settings className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Back to home
            </Link>
            <ThemeToggle />
          </div>
        </header>

        {notice && (
          <div
            className="mb-6 flex items-center justify-between rounded-lg border border-border bg-card p-3 text-sm text-foreground"
            role="status"
          >
            <span className="flex items-center gap-2">
              <Check className="h-4 w-4 text-emerald-500" />
              {notice}
            </span>
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => setNotice(null)}
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        )}

        <Tabs.Root value={activeTab} onValueChange={setActiveTab}>
          <Tabs.List className="mb-6 flex flex-wrap gap-1 border-b border-border">
            <SettingsTab value="account" label="Account & Security" icon={<UserCog className="h-4 w-4" />} />
            <SettingsTab value="appearance" label="Appearance" icon={<Sun className="h-4 w-4" />} />
            <SettingsTab value="notifications" label="Notifications" icon={<Bell className="h-4 w-4" />} />
            <SettingsTab value="data" label="Data & Lineage" icon={<Database className="h-4 w-4" />} />
            <SettingsTab value="danger" label="Danger Zone" icon={<ShieldAlert className="h-4 w-4" />} />
          </Tabs.List>

          <Tabs.Content value="account" className="space-y-6">
            <section className="rounded-xl border border-border bg-card p-6">
              <h2 className="text-lg font-semibold text-foreground">Account & Security</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Manage your academic semester and sign-in credentials.
              </p>

              <div className="mt-6 grid gap-6 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="semester"
                    className="mb-1 block text-sm font-medium text-foreground"
                  >
                    Current semester
                  </label>
                  <select
                    id="semester"
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
                    value={semester}
                    onChange={(e) => handleSemesterChange(Number(e.target.value))}
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>
                        Semester {n}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Advance your semester as you progress through your studies.
                  </p>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">
                    University email
                  </label>
                  <Input
                    readOnly
                    value={email}
                    aria-label="University email"
                    className="cursor-not-allowed opacity-80"
                  />
                  {emailDomain && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Verified via{' '}
                      <span className="font-medium text-foreground">@{emailDomain}</span>
                    </p>
                  )}
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-border bg-card p-6">
              <h2 className="text-lg font-semibold text-foreground">Change password</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Choose a strong password with at least 8 characters, an uppercase letter, a
                lowercase letter, and a number.
              </p>

              <form className="mt-5 space-y-4" onSubmit={onPwdSubmit}>
                <div>
                  <label
                    htmlFor="currentPassword"
                    className="mb-1 block text-sm font-medium text-foreground"
                  >
                    Current password
                  </label>
                  <Input
                    id="currentPassword"
                    type="password"
                    autoComplete="current-password"
                    {...registerPwd('currentPassword')}
                  />
                  <FieldError message={pwdErrors.currentPassword?.message} />
                </div>
                <div>
                  <label
                    htmlFor="newPassword"
                    className="mb-1 block text-sm font-medium text-foreground"
                  >
                    New password
                  </label>
                  <Input
                    id="newPassword"
                    type="password"
                    autoComplete="new-password"
                    {...registerPwd('newPassword')}
                  />
                  <FieldError message={pwdErrors.newPassword?.message} />
                </div>

                {pwdError && (
                  <div
                    className="rounded-md bg-destructive/10 p-3 text-sm text-destructive"
                    role="alert"
                  >
                    {pwdError}
                  </div>
                )}
                {pwdSuccess && (
                  <div
                    className="rounded-md bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-400"
                    role="status"
                  >
                    Your password has been updated.
                  </div>
                )}

                <Button type="submit" disabled={pwdSubmitting}>
                  {pwdSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Updating…
                    </>
                  ) : (
                    'Update password'
                  )}
                </Button>
              </form>
            </section>
          </Tabs.Content>

          <Tabs.Content value="appearance" className="space-y-6">
            <section className="rounded-xl border border-border bg-card p-6">
              <h2 className="text-lg font-semibold text-foreground">Theme</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Choose how Mathitis looks for you.
              </p>

              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <ThemeOption
                  active={preference === 'dark'}
                  label="Dark"
                  description="Default theme"
                  icon={<Moon className="h-5 w-5" />}
                  onClick={() => handleThemeChange('dark')}
                />
                <ThemeOption
                  active={preference === 'light'}
                  label="Light"
                  description="Bright and airy"
                  icon={<Sun className="h-5 w-5" />}
                  onClick={() => handleThemeChange('light')}
                />
                <ThemeOption
                  active={preference === 'system'}
                  label="Sync with system"
                  description="Follow OS preference"
                  icon={<Monitor className="h-5 w-5" />}
                  onClick={() => handleThemeChange('system')}
                />
              </div>
            </section>

            <section className="rounded-xl border border-border bg-card p-6">
              <h2 className="text-lg font-semibold text-foreground">Accessibility</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Tailor the interface to your comfort.
              </p>

              <div className="mt-5 space-y-4">
                <ToggleRow
                  checked={reducedMotion}
                  onChange={handleReducedMotion}
                  title="Reduced motion"
                  description="Disable heavy transitions and animations."
                />
                <ToggleRow
                  checked={highContrast}
                  onChange={handleHighContrast}
                  title="High-contrast accents"
                  description="Increase contrast of interactive accents."
                />
              </div>
            </section>

            <p className="text-xs text-muted-foreground">
              Current resolved theme:{' '}
              <span className="font-medium capitalize text-foreground">{theme}</span>
            </p>
          </Tabs.Content>

          <Tabs.Content value="notifications" className="space-y-6">
            <section className="rounded-xl border border-border bg-card p-6">
              <h2 className="text-lg font-semibold text-foreground">Alerts</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Control how you are notified about mentorship activity.
              </p>

              <div className="mt-5 space-y-4">
                <ToggleRow
                  checked={soundEnabled}
                  onChange={handleSoundToggle}
                  title="In-app sound chime"
                  description="Play a short chime when a new notification arrives."
                />
                <ToggleRow
                  checked={emailNotifications}
                  onChange={handleEmailNotifications}
                  title="Email notifications"
                  description="Receive transactional emails about requests and admin reviews."
                />
              </div>
            </section>
          </Tabs.Content>

          <Tabs.Content value="data" className="space-y-6">
            <section className="rounded-xl border border-border bg-card p-6">
              <h2 className="text-lg font-semibold text-foreground">Your data archive</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Download a complete JSON archive of your profile, tags, rich cards, request
                history, and lineage tree.
              </p>

              <Button className="mt-5" onClick={handleDownload}>
                <Download className="mr-2 h-4 w-4" /> Download my data
              </Button>
            </section>

            <section className="rounded-xl border border-border bg-card p-6">
              <h2 className="text-lg font-semibold text-foreground">Lineage summary</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Your academic family tree is preserved even if you deactivate your account.
              </p>
              <p className="mt-4 text-sm text-foreground">
                Active connections:{' '}
                <span className="font-semibold">{activeMentorships}</span>
              </p>
              <Link
                to="/lineage"
                className="mt-2 inline-block text-sm font-medium text-primary hover:underline"
              >
                View my lineage →
              </Link>
            </section>
          </Tabs.Content>

          <Tabs.Content value="danger" className="space-y-6">
            <section className="rounded-xl border border-destructive/30 bg-destructive/5 p-6">
              <h2 className="text-lg font-semibold text-destructive">Danger Zone</h2>
              <div className="mt-3 rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
                Deactivating your account removes your personal information, bio, and showcase
                cards. Your ancestral nodes on the Mentorship Lineage Graph will remain preserved
                as an anonymized alumnus to keep your academic family tree intact.
              </div>

              <Button
                variant="destructive"
                className="mt-5"
                onClick={() => {
                  setAnonymizeError(null);
                  setAnonymizeOpen(true);
                }}
              >
                <ShieldAlert className="mr-2 h-4 w-4" /> Anonymize account
              </Button>
            </section>
          </Tabs.Content>
        </Tabs.Root>
      </div>

      {anonymizeOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 p-4"
          onClick={() => setAnonymizeOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-foreground">Anonymize account?</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              This will permanently deactivate your account, scrub your personal information, and
              preserve you as an anonymized alumnus on the lineage graph. This cannot be undone.
            </p>

            <form className="mt-5 space-y-4" onSubmit={onAnonymizeSubmit}>
              <div>
                <label
                  htmlFor="anonymizePassword"
                  className="mb-1 block text-sm font-medium text-foreground"
                >
                  Enter your password to confirm
                </label>
                <Input
                  id="anonymizePassword"
                  type="password"
                  autoComplete="current-password"
                  {...registerAnon('password')}
                />
                <FieldError message={anonErrors.password?.message} />
              </div>

              {anonymizeError && (
                <div
                  className="rounded-md bg-destructive/10 p-3 text-sm text-destructive"
                  role="alert"
                >
                  {anonymizeError}
                </div>
              )}

              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => setAnonymizeOpen(false)}
                  disabled={anonymizeMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="destructive"
                  disabled={anonymizeMutation.isPending}
                >
                  {anonymizeMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deactivating…
                    </>
                  ) : (
                    'Anonymize account'
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function SettingsTab({
  value,
  label,
  icon,
}: {
  value: string;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <Tabs.Trigger
      value={value}
      className="flex items-center gap-2 border-b-2 border-transparent px-3 py-2 text-sm font-medium text-muted-foreground data-[state=active]:border-primary data-[state=active]:text-foreground"
    >
      {icon}
      {label}
    </Tabs.Trigger>
  );
}

function ThemeOption({
  active,
  label,
  description,
  icon,
  onClick,
}: {
  active: boolean;
  label: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-colors ${
        active
          ? 'border-primary bg-primary/10'
          : 'border-border bg-background hover:border-input'
      }`}
    >
      <span className={active ? 'text-primary' : 'text-muted-foreground'}>{icon}</span>
      <span className="text-sm font-semibold text-foreground">{label}</span>
      <span className="text-xs text-muted-foreground">{description}</span>
    </button>
  );
}

function ToggleRow({
  checked,
  onChange,
  title,
  description,
}: {
  checked: boolean;
  onChange: () => void;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={title}
        onClick={onChange}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          checked ? 'bg-primary' : 'bg-input'
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  );
}