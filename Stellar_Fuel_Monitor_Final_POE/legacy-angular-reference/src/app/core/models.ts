export type AlertSeverity = 'High' | 'Review' | 'Data Warning';
export type AlertStatus = 'Open' | 'Investigating' | 'Resolved';
export type TripRating = 'Poor' | 'Review' | 'Average' | 'Good' | 'Outstanding' | 'Baseline' | 'Data Warning';

export interface Vehicle {
  registration: string;
  description: string;
  type: string;
  manufacturer: string;
  model: string;
  status: 'Active' | 'Sold' | 'Scrapped' | string;
  vehicleGroup: string;
  peerType?: string;
  vin: string;
  odometerKm: number | null;
  currentKmL: number | null;
  currentRating?: TripRating | null;
  lastTripDate?: string | null;
  historicalMedianKmL?: number | null;
  benchmarkLow: number | null;
  benchmarkHigh: number | null;
  openAlerts: number;
  isTrailer?: boolean;
  axleConfiguration?: string | null;
  estimatedTareKg?: number | null;
  tareEstimateSource?: string | null;
  tareEstimateConfidence?: string | null;
}

export interface FuelTransaction {
  id: string;
  registration: string;
  date: string;
  litres: number;
  distanceKm: number | null;
  kmL: number | null;
  location: string;
  cost: number;
  source: 'Historical' | 'Prototype';
  fillUpLocation?: string | null;
  destination?: string | null;
  startKm?: number | null;
  endKm?: number | null;
  rating?: TripRating | null;
  expectedLitres?: number | null;
  excessLitres?: number | null;
  expectedDistanceKm?: number | null;
  extraKm?: number | null;
}

export interface FuelAlert {
  id: string;
  tripId?: string;
  registration: string;
  date: string;
  reason: string;
  severity: AlertSeverity;
  status: AlertStatus;
  kmL: number | null;
  benchmark: string;
  driver: string;
  trailer: string;
  loadContext: string;
  comment?: string;
  rating?: TripRating;
  deviationPct?: number | null;
  confidenceScore?: number;
  destination?: string | null;
  explanations?: string[];
}

export interface TripBenchmark {
  averageKmL: number;
  medianKmL: number;
  lowKmL: number;
  highKmL: number;
  sampleSize: number;
  excludedOutliers: number;
  standardDeviationKmL?: number | null;
  method?: string;
  scope: string;
  confidence: 'high' | 'medium' | 'low';
  averageDistanceKm?: number | null;
  averageLitres?: number | null;
  historyLimit?: number;
  weightedAverageKmL?: number | null;
  arithmeticAverageKmL?: number | null;
  totalDistanceKm?: number | null;
  totalLitres?: number | null;
  distinctTruckCount?: number;
  registrations?: string[];
  benchmarkType?: 'model-route' | 'truck-route' | string;
  modelLabel?: string | null;
  historyMonths?: number;
  historyStartDate?: string | null;
  historyEndDate?: string | null;
}

export interface DistanceBenchmark {
  expectedDistanceKm: number;
  averageDistanceKm: number;
  lowDistanceKm: number | null;
  highDistanceKm: number | null;
  actualDistanceKm: number;
  extraKm: number;
  distanceVariancePct: number | null;
  sampleSize: number;
  excludedOutliers: number;
  standardDeviationKmL?: number | null;
  method?: string;
  scope: string;
  confidence: 'high' | 'medium' | 'low';
  status: 'Normal' | 'Watch' | 'High' | 'Extreme' | 'Shorter' | string;
  routeLabel: string;
  calculation?: string;
  routeSpecific?: boolean;
}

export interface RecentFuelHistoryRow {
  id: string;
  current?: boolean;
  date: string;
  registration: string;
  driver?: string | null;
  fillUpLocation?: string | null;
  destination?: string | null;
  loadLocation?: string | null;
  startKm?: number | null;
  endKm?: number | null;
  kilometers?: number | null;
  litres?: number | null;
  consumptionKmL?: number | null;
  expectedDistanceKm?: number | null;
  extraKm?: number | null;
  distanceVariancePct?: number | null;
  distanceStatus?: string | null;
  googleRoadBenchmark?: GoogleRoadBenchmark | null;
  distanceConfidence?: string | null;
  distanceBenchmarkScope?: string | null;
  sourceKind?: string | null;
  contributesToCycle?: boolean;
  countedFuel?: boolean;
  isOpeningBoundary?: boolean;
  isClosingBoundary?: boolean;
  contributionRole?: string | null;
  countedDistanceKm?: number | null;
  countedFuelLitres?: number | null;
  distanceSharePct?: number | null;
  fuelSharePct?: number | null;
  segmentKmL?: number | null;
  segmentLPer100Km?: number | null;
}

export interface RecentFuelHistory {
  rows: RecentFuelHistoryRow[];
  summary: {
    recordCount: number;
    highlightedRecordCount?: number;
    countedFuelEventCount?: number;
    dieselTotalLitres: number | null;
    kmTotal: number | null;
    vehicleConsumptionKmL: number | null;
    vehicleConsumptionLPer100Km?: number | null;
    calculationMethod?: string | null;
    positiveExtraKm: number | null;
    netDistanceVarianceKm: number | null;
    openingOdometer: number | null;
    closingOdometer: number | null;
  };
}

export interface TruckMonthlyFuelHistory extends RecentFuelHistory {
  registration: string;
  month: string;
  fromDate?: string | null;
  toDate?: string | null;
  vehicle?: Vehicle;
}

export interface TripWeightContext {
  applied?: boolean;
  trailerRegistration?: string | null;
  productName?: string | null;
  truckTareKg?: number | null;
  trailerTareKg?: number | null;
  outboundProductKg?: number | null;
  returnProductKg?: number | null;
  loadedDistancePct?: number | null;
  referenceGrossKg?: number | null;
  averagePayloadKg?: number | null;
  averageGrossKg?: number | null;
  fuelMultiplier?: number | null;
  referencePayloadKg?: number | null;
  loadAdjustedExpectedKmL?: number | null;
  referenceNormalisedKmL?: number | null;
  truckTareSource?: string | null;
  trailerTareSource?: string | null;
  referencePayloadSource?: string | null;
  massInputUnit?: 'kg' | 't' | string;
  confirmed?: boolean;
  evidenceSource?: 'unverified' | 'timeworx' | 'dispatch' | 'weighbridge' | 'verified-manual' | string;
  sourceReference?: string | null;
  notes?: string;
  note?: string;
}

export interface TrailerEvidence {
  status: 'Verified' | 'Estimated' | 'Unknown';
  canNormalize: boolean;
  source: string;
  sourceReference?: string | null;
  trailerRegistration?: string | null;
  trailerDescription?: string | null;
  trailerStatus?: string | null;
  permitCapacityKg?: number | null;
  permitCapacityRaw?: string | null;
  permitCategory?: string | null;
  permitMake?: string | null;
  permitCount?: number;
  productName?: string | null;
  actualMassComplete?: boolean;
  loadingInstructionLinked?: boolean;
  loadingInstructionNo?: number | null;
  routeMatchConfidence?: string;
  note: string;
}


export interface FuelIntervalContext {
  intervalMode?: 'historical_consumption' | 'forward_fuel_interval' | string;
  startDate: string;
  nextFuelDate: string;
  startOdometer: number | null;
  nextOdometer: number | null;
  distanceKm: number | null;
  odometerDeltaRaw?: number | null;
  fuelLoadedLitres: number | null;
  startFillLocation: string | null;
  nextFillLocation: string | null;
  sourceConfirmation: string;
  attributionConfidence: 'high' | 'medium' | 'ambiguous' | 'low' | string;
  linkedLoadingInstructionCount: number;
  method: string;
  fuelEventId?: string | null;
  fuelEventDate?: string | null;
  capturedBy?: string | null;
  matchedFuelEntryCount?: number;
}

export interface LinkedLoadingInstructionContext {
  loadingInstructionNo: number;
  transactionDate?: string | null;
  customerCode?: string | null;
  customerName?: string | null;
  loadLocation?: string | null;
  offloadLocation?: string | null;
  loadArriveAtLocal?: string | null;
  loadDepartAtLocal?: string | null;
  offloadArriveAtLocal?: string | null;
  offloadDepartAtLocal?: string | null;
  loadStandingHours?: number | null;
  offloadStandingHours?: number | null;
  totalStandingHours?: number | null;
}

export interface GoogleRoadBenchmark {
  available: boolean; status: string; provider?: string; travelMode?: 'DRIVE' | string; origin?: string; destination?: string; oneWayKm?: number; benchmarkKm?: number; roundTrip?: boolean; actualDistanceKm?: number | null; varianceKm?: number | null; variancePct?: number | null; cache?: string; disclaimer: string;
}

export interface TripAnalysis {
  id: string;
  consumptionId: string;
  registration: string;
  modelKey?: string | null;
  modelLabel?: string | null;
  modelType?: string | null;
  modelAxleConfiguration?: string | null;
  modelIdentitySource?: string | null;
  date: string;
  cycleMode?: boolean;
  isFullTripCycle?: boolean;
  cycleId?: string;
  startDate?: string | null;
  endDate?: string | null;
  deliveryCount?: number;
  cycleFuelEventCount?: number;
  intermediateTopUpCount?: number;
  sourceReadingCount?: number;
  startFullUpLocation?: string | null;
  closingFullUpLocation?: string | null;
  mixedDestinations?: boolean;
  destinationCandidates?: string[];
  calculationMethod?: string | null;
  openingDate?: string | null;
  closingDate?: string | null;
  openingFillLocation?: string | null;
  closingFillLocation?: string | null;
  openingOdometer?: number | null;
  closingOdometer?: number | null;
  routeLabel?: string | null;
  destinationStops?: string[];
  destinationVisitCount?: number;
  destination: string | null;
  destinationSource: string;
  destinationConfidence: string;
  fillUpLocation: string | null;
  customerName: string | null;
  loadingInstructionNo: number | null;
  routeMatchConfidence: string;
  driverContext: string | null;
  kilometers: number | null;
  startKm?: number | null;
  endKm?: number | null;
  litres: number | null;
  distanceBenchmark?: DistanceBenchmark | null;
  expectedDistanceKm?: number | null;
  extraKm?: number | null;
  distanceVariancePct?: number | null;
  distanceStatus?: string | null;
  googleRoadBenchmark?: GoogleRoadBenchmark | null;
  reportedKmL: number | null;
  calculatedKmL: number | null;
  weightedTripKmL?: number | null;
  weightedTripLPer100Km?: number | null;
  analysedKmL: number | null;
  rawAnalysedKmL: number | null;
  corrected: boolean;
  correction: string | null;
  likelyDataError: boolean;
  qualityFlags: string[];
  benchmark: TripBenchmark | null;
  modelBenchmark?: TripBenchmark | null;
  truckBenchmark?: TripBenchmark | null;
  benchmarkSelection?: 'model-route' | 'truck-route-fallback' | 'baseline' | string;
  deviationPct: number | null;
  robustZ: number | null;
  performanceIndex: number | null;
  expectedRawKmL?: number | null;
  loadAdjustedExpectedKmL?: number | null;
  expectedLitres?: number | null;
  excessLitres?: number | null;
  fuelVariancePct?: number | null;
  rating: TripRating;
  confidenceScore: number;
  fuelInterval?: FuelIntervalContext | null;
  fuelAttributionConfidence?: string | null;
  fuelSourceConfirmation?: string | null;
  hasFuelEvidence?: boolean;
  linkedLoadingInstructions?: LinkedLoadingInstructionContext[];
  loadStandingHours?: number | null;
  offloadStandingHours?: number | null;
  totalStandingHours?: number | null;
  sourceKind?: string | null;
  fuelEvidence?: {
    year?: number;
    matchedFuelEntryCount?: number;
    fuelEntryId?: string | null;
    capturedBy?: string | null;
    rawFuelEntryConfirmed?: boolean;
    exactFuelEntryMatch?: boolean;
  } | null;
  weight: TripWeightContext;
  trailerEvidence?: TrailerEvidence;
  explanations: string[];
  cycleEvidence?: {
    openingTripId?: string;
    closingTripId?: string;
    sourceRowCount?: number;
    sourceRows?: string[];
    intermediateFills?: { id:string; date:string; fillUpLocation?:string|null; startKm?:number|null; endKm?:number|null; kilometers?:number|null; litres?:number|null; sourceKmL?:number|null; destination?:string|null; sourceKind?:string|null }[];
    boundaryAssumption?: string;
  };
  recentFuelHistory?: RecentFuelHistory;
  asset?: Vehicle;
}

export interface DailyAnalytics {
  date: string;
  totalTrips: number;
  averageKmL: number | null;
  counts: { poor: number; review: number; average: number; good: number; outstanding: number; baseline: number; dataWarnings: number; };
  distanceSummary?: { tripsWithBenchmark: number; positiveExtraKm: number; flaggedPositiveExtraKm: number; };
  needsReview: TripAnalysis[];
  outstanding: TripAnalysis[];
  dataWarnings: TripAnalysis[];
  trips: TripAnalysis[];
  fleet?: { activeTrucks: number; historicalTrips: number; latestCompleteDate: string; };
  source?: ApiHealth;
  navigation?: {
    selectedDate: string | null;
    previousDate: string | null;
    nextDate: string | null;
    minDate: string | null;
    maxDate: string | null;
    latestCompleteDate: string | null;
    hasData: boolean;
  };
  analyticsCache?: { enabled?: boolean; source?: string; benchmarkCount?: number; createdAt?: string; rebuilt?: boolean; };
}

export interface ApiHealth {
  ok: boolean;
  featureVersion?: string;
  source: 'mongodb' | 'latest-database-cache' | string;
  mongoConnected: boolean;
  databaseName: string;
  lastLoadedAt: string | null;
  dataset?: {
    datasetName?: string;
    datasetDate?: string;
    cacheFromDate?: string;
    assets?: number;
    permits?: number;
    trips?: number;
    fuelLinkedIntervals?: number;
    historicalTrips2026?: number;
    fuelLinkedHistoricalTrips2026?: number;
    fuelCoveragePct2026?: number;
    fuelFeatureYear?: number;
  };
  fleet?: { activeTrucks: number; historicalTrips: number; latestCompleteDate: string; };
}

export interface VehicleAnalytics {
  vehicle: Vehicle;
  destinations: { destination: string; count: number }[];
  trips: TripAnalysis[];
}

export interface TrailerSummary {
  registration: string;
  description: string;
  status: string;
  assetType?: string | null;
  axleConfiguration?: string | null;
  permits: { category?: string; permissibleWeightKgParsed?: number | null; permissibleWeightRaw?: string | null; make?: string | null }[];
  estimatedTareKg?: number | null;
  tareEstimateSource?: string | null;
  tareEstimateConfidence?: string | null;
  referencePayloadKg?: number | null;
  referencePayloadSource?: string | null;
}

export interface AnalyticsSettings {
  poorDeviationPct: number;
  reviewDeviationPct: number;
  goodDeviationPct: number;
  outstandingDeviationPct: number;
  minSameVehicleDestinationSamples: number;
  minFullCycleBenchmarkSamples: number;
  modelBenchmarkMonths?: number;
  minModelBenchmarkTrucks?: number;
  homeFillLocationPatterns: string[];
  minPeerDestinationSamples: number;
  outlierMadThreshold: number;
  weightNormalizationEnabled: boolean;
  weightSensitivity: number;
  defaultReferenceGrossKg: number;
  recentBenchmarkLimit?: number;
  note?: string;
}
