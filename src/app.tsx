import { useState, useCallback } from "react";
import { Login } from "./screens/Login";
import { Onboarding } from "./screens/Onboarding";
import { Landing } from "./screens/Landing";
import { Setup } from "./screens/Setup";
import { Session } from "./screens/Session";
import { Report } from "./screens/Report";
import { Dashboard } from "./screens/Dashboard";
import { SidebarLayout } from "./components/SidebarLayout";
import { ReportsList } from "./screens/ReportsList";
import { NotesList } from "./screens/NotesList";
import { SharedSessionSetup } from "./screens/SharedSessionSetup";
import { SharedRoom } from "./screens/SharedRoom";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { saveSession } from "./lib/db";
import type { SessionReport } from "./agents/rehearse-session";

type Screen = "login" | "onboarding" | "landing" | "setup" | "session" | "report" | "dashboard" | "reports" | "notes" | "shared-setup" | "shared-room";

interface SessionConfig {
  sessionId: string;
  speechDescription: string;
  domain: string;
  difficultyLevel: number;
}

export default function App() {
  const [screen,       setScreen]       = useState<Screen>("login");
  const [sessionConfig, setSessionConfig] = useState<SessionConfig | null>(null);
  const [report,        setReport]        = useState<SessionReport | null>(null);
  const [setupLoading,  setSetupLoading]  = useState(false);
  const [sharedRoom,    setSharedRoom]    = useState<{
    roomCode: string;
    speechDescription: string;
    domain: string;
    difficultyLevel: number;
  } | null>(null);

  // Authentication Flow
  const handleGuestLogin = useCallback(() => {
    // Basic local storage check to see if they've onboarded before
    const hasOnboarded = localStorage.getItem("rehearse_onboarded") === "true";
    if (hasOnboarded) {
      setScreen("landing");
    } else {
      setScreen("onboarding");
    }
  }, []);

  const handleOnboardingComplete = useCallback(() => {
    localStorage.setItem("rehearse_onboarded", "true");
    setScreen("landing");
  }, []);

  // Main Flow
  const handleStart = useCallback(() => setScreen("setup"), []);
  const handleDashboard = useCallback(() => setScreen("dashboard"), []);

  const handleStartSession = useCallback(async (config: {
    speechDescription: string;
    domain: string;
    difficultyLevel: number;
    customPersonas?: import("./lib/personas").CustomPersonaData[];
  }) => {
    setSetupLoading(true);
    const userId = localStorage.getItem("rehearse_userId") ?? (() => {
      const id = crypto.randomUUID();
      localStorage.setItem("rehearse_userId", id);
      return id;
    })();
    try {
      const resp = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          speechDescription: config.speechDescription,
          domain:            config.domain,
          difficultyLevel:   config.difficultyLevel,
          userId,
          ...(config.customPersonas?.length
            ? { customPersonaIds: config.customPersonas.map(p => p.id) }
            : {})
        })
      });
      const sessionId = resp.ok ? (await resp.json() as { sessionId: string }).sessionId : crypto.randomUUID();
      setSessionConfig({ sessionId, speechDescription: config.speechDescription, domain: config.domain, difficultyLevel: config.difficultyLevel });
      setScreen("session");
    } catch {
      setSessionConfig({ sessionId: crypto.randomUUID(), speechDescription: config.speechDescription, domain: config.domain, difficultyLevel: config.difficultyLevel });
      setScreen("session");
    } finally {
      setSetupLoading(false);
    }
  }, []);

  const handleSessionEnd = useCallback((r: SessionReport) => {
    // Save to DB (localStorage + Supabase)

    if (sessionConfig) {
      saveSession({
        sessionId:         sessionConfig.sessionId,
        date:              new Date().toISOString(),
        topic:             sessionConfig.speechDescription,
        domain:            sessionConfig.domain,
        difficultyLevel:   sessionConfig.difficultyLevel,
        score:             r.score,
        duration:          r.duration,
        bestMoment:        r.bestMoment,
        hardestMoment:     r.hardestMoment,
        improvement:       r.improvement,
        interventionCount: r.interventionCount,
      }).catch(console.error);
    }
    setReport(r);
    setScreen("report");
  }, [sessionConfig]);

  const handleNewSession = useCallback(() => {
    setReport(null);
    setSessionConfig(null);
    setScreen("landing");
  }, []);

  return (
    <ErrorBoundary>
      <div className="app">
        {screen === "login"      && <Login onGuestLogin={handleGuestLogin} />}
        {screen === "onboarding" && <Onboarding onComplete={handleOnboardingComplete} />}

        {/* Wrapped App Screens */}
        {["landing","setup","session","report","dashboard","reports","notes","shared-setup","shared-room"].includes(screen) && (
          <SidebarLayout currentScreen={screen} onNavigate={(s: Screen) => setScreen(s)}>
            {screen === "landing"      && <Landing onStart={handleStart} onDashboard={handleDashboard} userName="Guest" />}
            {screen === "setup"        && <Setup onBack={() => setScreen("landing")} onStartSession={handleStartSession} loading={setupLoading} />}
            {screen === "session"      && sessionConfig && <Session config={sessionConfig} onEnd={handleSessionEnd} />}
            {screen === "report"       && report && <Report report={report} onNewSession={handleNewSession} />}
            {screen === "dashboard"    && <Dashboard onBack={() => setScreen("landing")} />}
            {screen === "reports"      && <ReportsList />}
            {screen === "notes"        && <NotesList />}
            {screen === "shared-setup" && (
              <SharedSessionSetup
                onRoomCreated={(roomCode, config) => {
                  setSharedRoom({ roomCode, ...config });
                  setScreen("shared-room");
                }}
                onJoin={() => setScreen("shared-room")}
              />
            )}
            {screen === "shared-room" && sharedRoom && (
              <SharedRoom
                roomCode={sharedRoom.roomCode}
                speechDescription={sharedRoom.speechDescription}
                domain={sharedRoom.domain}
                difficultyLevel={sharedRoom.difficultyLevel}
                onLeave={() => { setSharedRoom(null); setScreen("landing"); }}
              />
            )}
          </SidebarLayout>
        )}
      </div>
    </ErrorBoundary>
  );
}


