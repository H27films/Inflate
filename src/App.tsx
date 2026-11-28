import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowLeftRight, Plus } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { onAuthStateChanged, signInWithPopup, type User } from 'firebase/auth';
import {
  CarId,
  CarProfile,
  CarRenewals,
  CORNER_LABELS,
  PressureLogEntry,
  PurchaseLogEntry,
  SavedTyreOption,
  TYRE_CORNERS,
  TyreContact,
  TyreCorner,
} from './types';
import {
  formatTyreAgeMonths,
  formatWeekdayMonthDay,
  getCornerPurchaseInfo,
  getDaysSince,
  INITIAL_GARAGE,
} from './data/initialGarage';
import { auth, googleProvider } from './firebase';
import {
  addContactRecord,
  addPressureLogRecord,
  addPurchaseLogRecord,
  addSavedTyreRecord,
  deleteContactRecord,
  deletePressureLogRecord,
  deletePurchaseLogRecord,
  deleteSavedTyreRecord,
  ensureUserGarageSeeded,
  subscribeToUserGarage,
  updateCarRenewalsRecord,
  updateContactRecord,
  updatePressureLogRecord,
  updateSavedTyreRecord,
} from './services/garageFirestore';
import { CarBirdsEyeView } from './components/CarBirdsEyeView';
import { PressureLogSheet } from './components/PressureLogSheet';
import { PurchasesView } from './components/PurchasesView';
import { QuickLogModal } from './components/QuickLogModal';
import { ActiveTab, BottomNav } from './components/BottomNav';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './components/OfflineIndicator';
import { SplashScreen } from './components/SplashScreen';
import { SignInScreen } from './components/SignInScreen';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const [hydratingData, setHydratingData] = useState(false);
  const [fatalError, setFatalError] = useState<Error | null>(null);

  const [carsMeta, setCarsMeta] = useState<
    Partial<Record<CarId, Omit<CarProfile, 'pressureLogs' | 'purchaseLogs'>>>
  >({});
  const [pressureLogsByCar, setPressureLogsByCar] = useState<Record<CarId, PressureLogEntry[]>>({
    slk250: [],
    fortuner: [],
  });
  const [purchaseLogsByCar, setPurchaseLogsByCar] = useState<Record<CarId, PurchaseLogEntry[]>>({
    slk250: [],
    fortuner: [],
  });
  const [savedTyresByCar, setSavedTyresByCar] = useState<Record<CarId, SavedTyreOption[]>>({
    slk250: [],
    fortuner: [],
  });
  const [savedTyresSynced, setSavedTyresSynced] = useState(false);
  const [savedTyresRulesPending, setSavedTyresRulesPending] = useState(false);
  const [contacts, setContacts] = useState<TyreContact[]>([]);

  const [activeCarId, setActiveCarId] = useState<CarId>('slk250');
  const [activeTab, setActiveTab] = useState<ActiveTab>('garage');
  const [selectedCorner, setSelectedCorner] = useState<TyreCorner | null>(null);
  const [logExpanded, setLogExpanded] = useState(false);
  const [purchasesExpanded, setPurchasesExpanded] = useState(false);
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [addPurchaseOpen, setAddPurchaseOpen] = useState(false);
  const [introComplete, setIntroComplete] = useState(false);
  const [manualSplashOpen, setManualSplashOpen] = useState(false);
  const [hasShownSignIn, setHasShownSignIn] = useState(false);
  const [bootSplashFinished, setBootSplashFinished] = useState(false);

  useEffect(() => {
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timer = window.setTimeout(() => {
      setIntroComplete(true);
    }, prefersReduced ? 320 : 2900);
    return () => window.clearTimeout(timer);
  }, []);

  if (fatalError) {
    throw fatalError;
  }

  useEffect(() => {
    const fallbackTimer = window.setTimeout(() => {
      setAuthReady(true);
    }, 3000);
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      window.clearTimeout(fallbackTimer);
      setUser(nextUser);
      setAuthReady(true);
      setAuthError(null);
      if (!nextUser) {
        setHasShownSignIn(true);
      }
    });
    return () => {
      window.clearTimeout(fallbackTimer);
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setCarsMeta({});
      setPressureLogsByCar({ slk250: [], fortuner: [] });
      setPurchaseLogsByCar({ slk250: [], fortuner: [] });
      setSavedTyresByCar({ slk250: [], fortuner: [] });
      setSavedTyresSynced(false);
      setSavedTyresRulesPending(false);
      setContacts([]);
      setHydratingData(false);
      return;
    }

    let cancelled = false;
    setHydratingData(true);

    let carsLoaded = false;
    let hasCarDocs = false;
    let pressureLoaded = false;
    let purchasesLoaded = false;
    let contactsLoaded = false;
    let seedingDone = false;

    const hydrationCapTimer = window.setTimeout(() => {
      if (!cancelled) {
        setHydratingData(false);
      }
    }, 1800);

    const markLoaded = () => {
      if (
        !cancelled &&
        carsLoaded &&
        pressureLoaded &&
        purchasesLoaded &&
        contactsLoaded &&
        (hasCarDocs || seedingDone)
      ) {
        window.clearTimeout(hydrationCapTimer);
        setHydratingData(false);
      }
    };

    const unsubscribeData = subscribeToUserGarage(user.uid, {
      onCars: (nextCars) => {
        setCarsMeta(nextCars);
        carsLoaded = true;
        hasCarDocs = Object.keys(nextCars).length > 0;
        markLoaded();
      },
      onPressureLogs: (grouped) => {
        setPressureLogsByCar(grouped);
        pressureLoaded = true;
        markLoaded();
      },
      onPurchaseLogs: (grouped) => {
        setPurchaseLogsByCar(grouped);
        purchasesLoaded = true;
        markLoaded();
      },
      onContacts: (list) => {
        setContacts(list);
        contactsLoaded = true;
        markLoaded();
      },
      onSavedTyres: (grouped, hasDocs) => {
        setSavedTyresByCar(grouped);
        setSavedTyresSynced(hasDocs);
      },
      onSavedTyresRulesPending: (pending) => {
        setSavedTyresRulesPending(pending);
      },
      onError: (err) => {
        setFatalError(err);
      },
    });

    ensureUserGarageSeeded(user.uid)
      .then(() => {
        seedingDone = true;
        markLoaded();
      })
      .catch((err) => {
        if (!cancelled) {
          setFatalError(err instanceof Error ? err : new Error(String(err)));
        }
      });

    return () => {
      cancelled = true;
      window.clearTimeout(hydrationCapTimer);
      unsubscribeData();
    };
  }, [user?.uid]);

  const garage = useMemo<Record<CarId, CarProfile>>(() => {
    const buildCar = (carId: CarId): CarProfile => {
      const fallback = INITIAL_GARAGE[carId];
      const meta = carsMeta[carId];
      return {
        ...(meta ?? {
          id: fallback.id,
          displayTitle: fallback.displayTitle,
          make: fallback.make,
          model: fallback.model,
          trim: fallback.trim,
          year: fallback.year,
          bodyStyle: fallback.bodyStyle,
          paintHex: fallback.paintHex,
          accentLabel: fallback.accentLabel,
          recommendedKpa: fallback.recommendedKpa,
          defaultSizes: fallback.defaultSizes,
          renewals: fallback.renewals,
        }),
        pressureLogs: pressureLogsByCar[carId],
        purchaseLogs: purchaseLogsByCar[carId],
        savedTyres: savedTyresSynced
          ? savedTyresByCar[carId]
          : savedTyresRulesPending
            ? fallback.savedTyres ?? []
            : savedTyresByCar[carId],
      };
    };

    return {
      slk250: buildCar('slk250'),
      fortuner: buildCar('fortuner'),
    };
  }, [carsMeta, pressureLogsByCar, purchaseLogsByCar, savedTyresByCar, savedTyresSynced, savedTyresRulesPending]);

  const handleGoogleSignIn = async () => {
    if (signingIn) return;
    setAuthError(null);
    setSigningIn(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      const rawMessage =
        error instanceof Error ? error.message : 'Unable to sign in with Google.';
      const isUnauthorizedDomain =
        rawMessage.includes('auth/unauthorized-domain') ||
        (typeof error === 'object' &&
          error !== null &&
          'code' in error &&
          (error as { code?: unknown }).code === 'auth/unauthorized-domain');
      setAuthError(
        isUnauthorizedDomain
          ? `Unauthorized domain (${window.location.hostname}). Add this domain in Firebase Console → Authentication → Settings → Authorized domains.`
          : rawMessage
      );
    } finally {
      setSigningIn(false);
    }
  };

  const isBootHydrating =
    !bootSplashFinished &&
    (!authReady || (Boolean(user) && hydratingData && !hasShownSignIn));
  const isInteractiveSyncing = Boolean(user) && hydratingData && hasShownSignIn;
  const showSplash =
    (!bootSplashFinished && (!introComplete || isBootHydrating)) ||
    manualSplashOpen;

  useEffect(() => {
    if (!bootSplashFinished && introComplete && !isBootHydrating) {
      setBootSplashFinished(true);
    }
  }, [bootSplashFinished, introComplete, isBootHydrating]);

  const renderContent = () => {
    if (isBootHydrating) {
      return <div className="min-h-dvh bg-[#F3F4F2] text-[#111315]" />;
    }

    if (!user || isInteractiveSyncing) {
      return (
        <SignInScreen
          signingIn={signingIn}
          syncing={isInteractiveSyncing}
          authError={authError}
          onSignIn={handleGoogleSignIn}
        />
      );
    }

    const activeCar = garage[activeCarId];
  const otherCarId: CarId = activeCarId === 'slk250' ? 'fortuner' : 'slk250';
  const otherCar = garage[otherCarId];

  const handleSwapCar = () => {
    setActiveCarId(otherCarId);
    setSelectedCorner(null);
  };

  const sortedPressureLogs = [...activeCar.pressureLogs].sort((a, b) =>
    b.date.localeCompare(a.date)
  );

  const carWithSortedLogs: CarProfile = {
    ...activeCar,
    pressureLogs: sortedPressureLogs,
  };

  const latestPressure = sortedPressureLogs[0] ?? null;
  const daysSinceLastTopUp = latestPressure ? getDaysSince(latestPressure.date) : null;

  const runFirestoreAction = (promise: Promise<void>) => {
    promise.catch((err) => {
      setFatalError(err instanceof Error ? err : new Error(String(err)));
    });
  };

  const handleAddPressureLog = (entry: Omit<PressureLogEntry, 'id'>) => {
    runFirestoreAction(addPressureLogRecord(user.uid, activeCarId, entry));
  };

  const handleEditPressureLog = (id: string, entry: Omit<PressureLogEntry, 'id'>) => {
    runFirestoreAction(updatePressureLogRecord(id, entry));
  };

  const handleDeletePressureLog = (id: string) => {
    runFirestoreAction(deletePressureLogRecord(id));
  };

  const handleAddPurchase = (entry: Omit<PurchaseLogEntry, 'id'>) => {
    runFirestoreAction(addPurchaseLogRecord(user.uid, activeCarId, entry));
  };

  const handleDeletePurchase = (id: string) => {
    runFirestoreAction(deletePurchaseLogRecord(id));
  };

  const handleAddContact = (entry: Omit<TyreContact, 'id'>) => {
    runFirestoreAction(addContactRecord(user.uid, entry));
  };

  const handleUpdateContact = (id: string, entry: Omit<TyreContact, 'id'>) => {
    runFirestoreAction(updateContactRecord(id, entry));
  };

  const handleDeleteContact = (id: string) => {
    runFirestoreAction(deleteContactRecord(id));
  };

  const handleAddSavedTyre = (entry: Omit<SavedTyreOption, 'id'>) =>
    addSavedTyreRecord(user.uid, activeCarId, entry);

  const handleUpdateSavedTyre = (id: string, entry: Omit<SavedTyreOption, 'id'>) =>
    updateSavedTyreRecord(id, activeCarId, entry);

  const handleDeleteSavedTyre = (id: string) => deleteSavedTyreRecord(id);

  const handleUpdateRenewal = (field: keyof CarRenewals, date: string) => {
    const fallbackRenewals = INITIAL_GARAGE[activeCarId].renewals ?? {
      insurance: '2027-01-10',
      cartax: '2027-01-10',
    };
    const current = activeCar.renewals ?? fallbackRenewals;
    const nextRenewals: CarRenewals = {
      insurance: current.insurance,
      cartax: current.cartax,
      ...(activeCarId === 'slk250'
        ? { coolant: current.coolant ?? fallbackRenewals.coolant ?? '2026-11-16' }
        : {}),
      ...(current.carWash ? { carWash: current.carWash } : {}),
      [field]: date,
    };
    runFirestoreAction(updateCarRenewalsRecord(user.uid, activeCarId, nextRenewals));
  };

  return (
      <div
        className={
          activeTab === 'garage'
            ? 'h-dvh overflow-hidden bg-[#F3F4F2] text-[#111315] flex flex-col'
            : 'min-h-dvh bg-[#F3F4F2] text-[#111315] flex flex-col'
        }
      >
        <OfflineIndicator />
      {/* Top Bar: Left Add Purchase (on Purchases) or PWA Install (on Home) · Centered INFLATE · Top-Right Switch Cars */}
      <header className="shrink-0 z-20 bg-[#F3F4F2] border-b border-black/6 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <div className="max-w-5xl lg:max-w-[540px] mx-auto px-4 h-13 pb-0.5 relative flex items-center justify-center">

          {activeTab === 'purchases' ? (
            <button
              type="button"
              onClick={() => setAddPurchaseOpen(true)}
              aria-label="Add tyre purchase"
              title="Add tyre purchase"
              className="absolute left-3.5 w-8 h-8 rounded-full bg-[#111315] text-white border border-black/8 shadow-[0_2px_8px_rgba(17,19,21,0.04)] hover:bg-black/85 active:scale-[0.96] transition-all flex items-center justify-center cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-white" />
            </button>
          ) : (
            <div className="absolute left-3.5">
              <PWAInstallButton />
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              setLogExpanded(false);
              if (activeTab === 'garage') {
                setManualSplashOpen(true);
              } else {
                setActiveTab('garage');
              }
            }}
            aria-label={activeTab === 'garage' ? 'View Inflate intro screen' : 'Go to Home'}
            title={activeTab === 'garage' ? 'View Inflate intro screen' : 'Go to Home'}
            className="font-brand text-sm sm:text-[15px] tracking-[0.42em] pl-[0.42em] uppercase text-[#111315] hover:opacity-70 active:scale-[0.98] transition-all cursor-pointer py-2"
          >
            INFLATE
          </button>

          <button
            type="button"
            onClick={handleSwapCar}
            aria-label={`Switch car to ${otherCar.displayTitle}`}
            title={`Switch to ${otherCar.displayTitle}`}
            className="absolute right-3.5 w-8 h-8 rounded-full bg-white border border-black/8 shadow-[0_2px_8px_rgba(17,19,21,0.04)] hover:bg-black/[0.02] active:scale-[0.96] transition-all flex items-center justify-center cursor-pointer"
          >
            <ArrowLeftRight className="w-3.5 h-3.5 text-[#111315]" />
          </button>
        </div>
      </header>

      {activeTab === 'purchases' ? (
        <>
          {!purchasesExpanded && (
            <div
              aria-hidden="true"
              className="pointer-events-none fixed inset-x-0 bottom-0 h-52 z-0 bg-gradient-to-b from-transparent via-[#E5E8E2]/80 to-[#CFD4CC]"
            />
          )}
          <main className="relative z-10 flex-1 flex flex-col w-full pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
            <PurchasesView
              car={carWithSortedLogs}
              contacts={contacts}
              addModalOpen={addPurchaseOpen}
              onOpenAddModal={() => setAddPurchaseOpen(true)}
              onCloseAddModal={() => setAddPurchaseOpen(false)}
              onAddPurchase={handleAddPurchase}
              onDeletePurchase={handleDeletePurchase}
              onAddContact={handleAddContact}
              onUpdateContact={handleUpdateContact}
              onDeleteContact={handleDeleteContact}
              savedTyresRulesPending={savedTyresRulesPending}
              onAddSavedTyre={handleAddSavedTyre}
              onUpdateSavedTyre={handleUpdateSavedTyre}
              onDeleteSavedTyre={handleDeleteSavedTyre}
              onExpandedChange={setPurchasesExpanded}
            />
          </main>
        </>
      ) : (
        /* Single-page zero-scroll Home layout */
        <>
          <div
            aria-hidden="true"
            className="pointer-events-none fixed inset-x-0 bottom-0 h-44 z-0 bg-gradient-to-b from-transparent via-[#E8EAE6]/75 to-[#D6DAD3]"
          />
          <main className="relative z-10 flex-1 min-h-0 max-w-5xl lg:max-w-[540px] w-full mx-auto pt-2.5 pb-[calc(4.7rem+env(safe-area-inset-bottom))] flex flex-col justify-between lg:justify-center gap-2 lg:gap-4">
          {/* Top Section: Vehicle Title + Last Top-Up + Bird's-Eye Image + FL/FR/RL/RR Boxes */}
          <section className="flex-1 lg:flex-initial min-h-0 px-4 flex flex-col gap-2 lg:gap-3">
            <div className="shrink-0 px-0.5 space-y-0.5">
              <div className="flex items-baseline justify-between gap-2">
                <h1 className="font-display text-xl sm:text-2xl font-medium tracking-tight text-[#111315] leading-tight">
                  {activeCar.displayTitle}
                </h1>
                {daysSinceLastTopUp !== null && (
                  <span className="font-display text-xl sm:text-2xl font-light tracking-tight text-[#5E646A] tabular-nums leading-tight shrink-0">
                    {daysSinceLastTopUp === 0
                      ? 'Today'
                      : daysSinceLastTopUp === 1
                        ? '1 day'
                        : `${daysSinceLastTopUp} days`}
                  </span>
                )}
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-xs text-[#5E646A] tabular-nums">
                  Last Top Up:{' '}
                  <span>
                    {latestPressure ? formatWeekdayMonthDay(latestPressure.date) : '—'}
                  </span>
                </p>
                {selectedCorner && (
                  <span className="text-xs font-medium text-[#FF5A1F] shrink-0">
                    {CORNER_LABELS[selectedCorner]}
                  </span>
                )}
              </div>
            </div>

            {/* Bird's-Eye Car Image without box */}
            <div className="flex-1 lg:flex-none min-h-[160px] max-h-[330px] md:max-h-[255px] lg:h-[clamp(180px,31dvh,310px)] lg:max-h-[310px] py-2 md:py-0 relative">
              <CarBirdsEyeView
                car={carWithSortedLogs}
                selectedCorner={selectedCorner}
                onSelectCorner={setSelectedCorner}
                onUpdateRenewal={handleUpdateRenewal}
              />
            </div>

            {/* 4 Corner Boxes: FL, FR, RL, RR showing set kPa, age top-right, and PSI (or prev reading when selected) bottom-right */}
            <div className="shrink-0 mt-auto md:mt-0 pb-1.5 md:pb-0 grid grid-cols-2 gap-2.5">
              {TYRE_CORNERS.map((corner) => {
                const setKpa = activeCar.recommendedKpa[corner];
                const psiApprox = Math.round(setKpa * 0.145);
                const purchaseInfo = getCornerPurchaseInfo(activeCar.purchaseLogs, corner);
                const tyreAge = purchaseInfo ? formatTyreAgeMonths(purchaseInfo.date) : null;
                const isSelected = selectedCorner === corner;

                let lastPrevKpa: number | null = null;
                for (const entry of sortedPressureLogs) {
                  const beforeVal = entry.beforePressures?.[corner];
                  const lowBeforeVal =
                    entry.lowTyre?.corner === corner ? entry.lowTyre.beforeKpa : undefined;
                  const resolved = beforeVal ?? lowBeforeVal;
                  if (resolved !== undefined) {
                    lastPrevKpa = resolved;
                    break;
                  }
                }

                return (
                  <button
                    key={corner}
                    type="button"
                    onClick={() => setSelectedCorner(isSelected ? null : corner)}
                    className={`px-3 py-2.5 rounded-2xl text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#111315] text-white shadow-[0_0_10px_1px_rgba(17,19,21,0.18)]'
                        : 'bg-[#E6E8E4] text-[#111315] shadow-[0_0_8px_1px_rgba(17,19,21,0.07)] hover:bg-[#DFE2DD]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 whitespace-nowrap">
                      <span
                        className={`font-mono text-xs font-semibold shrink-0 ${
                          isSelected ? 'text-[#FF5A1F]' : 'text-[#5E646A]'
                        }`}
                      >
                        {corner}
                      </span>
                      {tyreAge && (
                        <span
                          className={`font-display text-[13px] font-semibold tracking-tight tabular-nums whitespace-nowrap ${
                            isSelected ? 'text-white/95' : 'text-[#111315]'
                          }`}
                        >
                          {tyreAge}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex items-baseline justify-between gap-2">
                      <div className="flex items-baseline gap-1">
                        <span className="font-display text-xl font-bold tabular-nums leading-none">
                          {setKpa}
                        </span>
                        <span
                          className={`text-[11px] font-mono ${
                            isSelected ? 'text-white/70' : 'text-[#5E646A]'
                          }`}
                        >
                          kPa
                        </span>
                      </div>
                      <span
                        className={`font-mono text-[10.5px] sm:text-[11px] tracking-tight tabular-nums whitespace-nowrap inline-flex items-center gap-1 ${
                          isSelected ? 'text-white/75' : 'text-[#5E646A]'
                        }`}
                      >
                        {isSelected ? (
                          <>
                            <ArrowLeft className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0" aria-hidden="true" />
                            <span>{lastPrevKpa !== null ? `${lastPrevKpa} kPa` : '—'}</span>
                          </>
                        ) : (
                          `${psiApprox} PSI`
                        )}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Floating Rounded Pressure Log Card */}
          <div className="shrink-0 w-full px-4">
            <PressureLogSheet
              car={carWithSortedLogs}
              expanded={logExpanded}
              onToggleExpanded={setLogExpanded}
              onAddLog={handleAddPressureLog}
              onEditLog={handleEditPressureLog}
              onDeleteLog={handleDeletePressureLog}
            />
          </div>
          </main>
        </>
      )}

      {/* Sticky Bottom Navigation Bar: Home (Left) · Purchases (Middle) · Log (Right) */}
      <BottomNav
        activeTab={activeTab}
        lightSurface={logExpanded}
        showBackdrop={activeTab === 'purchases' ? purchasesExpanded : logExpanded}
        onSelectTab={(tab) => {
          setLogExpanded(false);
          setActiveTab(tab);
        }}
        onOpenLog={() => {
          setLogExpanded(false);
          setLogModalOpen(true);
        }}
      />

      {/* Quick Log Modal (Date + Location) */}
      <QuickLogModal
        open={logModalOpen}
        car={carWithSortedLogs}
        onClose={() => setLogModalOpen(false)}
        onLogCreated={handleAddPressureLog}
      />
    </div>
    );
  };

  return (
    <>
      <AnimatePresence>
        {showSplash && (
          <SplashScreen
            key="inflate-splash"
            stillLoading={!manualSplashOpen && introComplete && isBootHydrating}
            interactive={manualSplashOpen}
            onDismiss={() => setManualSplashOpen(false)}
          />
        )}
      </AnimatePresence>
      {renderContent()}
    </>
  );
}
