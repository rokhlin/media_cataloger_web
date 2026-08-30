export type Language = 'en' | 'ru';

export interface HeaderTranslations {
  appTitle: string;
  appSubtitle: string;
  navMain: string;
  navMediaLibrary: string;
  navFamilyTree: string;
  navMainTooltip: string;
  navMediaLibraryTooltip: string;
  navFamilyTreeTooltip: string;
  statusIdle: string;
  statusRunning: string;
  statusPaused: string;
  statusCompleted: string;
  statusStopped: string;
  statusFailed: string;
  statusChecking: string;
  taskSync: string;
  taskSingle: string;
  btnShowLogs: string;
  btnHideLogs: string;
  btnSettings: string;
  langSwitchEn: string;
  langSwitchRu: string;
  langSwitchTooltip: string;
}

export interface ExecutionControlsTranslations {
  controlsTitle: string;
  btnRunSync: string;
  btnPause: string;
  btnResume: string;
  btnStop: string;
  btnAnalyzeSingle: string;
  placeholderSingleFile: string;
  statusLabel: string;
  progressLabel: string;
  currentFileLabel: string;
  stageLabel: string;
  confirmStop: string;
  syncSectionTitle: string;
  syncSectionDesc: string;
  forceReprocessLabel: string;
  singleFileSectionTitle: string;
  singleFileSectionDesc: string;
  chooseFileTooltip: string;
  analyzeButtonText: string;
  alertEnterPath: string;
}

export interface GalleryTranslations {
  galleryTitle: string;
  searchPlaceholder: string;
  searchHint: string;
  filterAllTypes: string;
  filterImages: string;
  filterVideos: string;
  filterAllStatus: string;
  filterProcessed: string;
  filterUnprocessed: string;
  filterPending: string;
  filterFaceAll: string;
  filterFaceWith: string;
  filterFaceWithout: string;
  filterFaceUnassigned: string;
  filterPersonAll: string;
  btnResetFilters: string;
  showingCount: string;
  scanningSources: string;
  noMediaFound: string;
  noMediaHintFiltered: string;
  noMediaHintEmpty: string;
  cardFaceCount: string;
  cardMoreFaces: string;
  clickToView: string;
  badgeMediaFiles: string;
  badgeCataloged: string;
  badgePhotos: string;
  badgeVideos: string;
  btnRefreshGallery: string;
  btnControlsSwitch: string;
  searchActiveStatus: string;
  loadMoreRows: string;
  allLoaded: string;
}

export interface LightboxTranslations {
  fileDetails: string;
  fullPath: string;
  status: string;
  sidecar: string;
  fileSize: string;
  modifiedDate: string;
  aiDescription: string;
  aiSummary: string;
  summaryBadge: string;
  environment: string;
  environmentIndoor: string;
  environmentOutdoor: string;
  lighting: string;
  weather: string;
  timeOfDay: string;
  ocrText: string;
  exifAnalysis: string;
  audioTranscription: string;
  timelineEvents: string;
  duplicateAnalysis: string;
  detectedFaces: string;
  loadingFaces: string;
  noFacesIndexed: string;
  btnAnalyzeFile: string;
  btnOpenOriginal: string;
  prevImageTooltip: string;
  nextImageTooltip: string;
  closeTooltip: string;
  langPreviewToggle: string;
  tagPerson: string;
  selectPersonPlaceholder: string;
  addNewPersonOption: string;
  customPersonNamePlaceholder: string;
  btnTagPerson: string;
  removePersonTooltip: string;
  changePerson: string;
  badgeManual: string;
}

export interface FaceRegistryTranslations {
  faceRegistryTitle: string;
  tabKnownPersons: string;
  tabUnrecognizedFaces: string;
  tabClusters: string;
  searchPersonsPlaceholder: string;
  searchGroupsPlaceholder: string;
  searchFacesPlaceholder: string;
  btnResetByFile: string;
  btnResetAllFaces: string;
  totalPersons: string;
  totalFaces: string;
  totalClusters: string;
  loadingFaceRegistry: string;
  noPersonsFound: string;
  noPersonsYet: string;
  noUnrecFacesFound: string;
  noClustersFound: string;
  noMatchingGroups: string;
  noMatchingPersons: string;
  noMatchingFaces: string;
  btnAssign: string;
  btnAssignTo: string;
  btnAssignGroup: string;
  btnAssigning: string;
  btnRename: string;
  btnReset: string;
  btnDelete: string;
  btnViewSources: string;
  assignFaceModalTitle: string;
  assignGroupModalTitle: string;
  renamePersonModalTitle: string;
  resetByFileModalTitle: string;
  selectKnownPerson: string;
  orCreateNewPerson: string;
  enterPersonName: string;
  enterFileName: string;
  resetByFileDescription: string;
  btnCancel: string;
  btnSave: string;
  btnSaving: string;
  btnConfirm: string;
  btnResetting: string;
  badgeKnown: string;
  badgePending: string;
  badgeCluster: string;
  confidence: string;
  shotsCountUnit: string;
  refPhotoUnitSingle: string;
  refPhotoUnitPlural: string;
  appearedInLabel: string;
  assignGroupToPersonOption: string;
  assignSingleToPersonOption: string;
  newPersonOption: string;
  unassignedName: string;
  faceIdentificationTitle: string;
  sourceFileTitle: string;
  personNameLabel: string;
  promptNoSourcePath: string;
  promptSelectPersonOrName: string;
  promptResetFaceConfirm: string;
  promptDeleteFaceConfirm: string;
  promptEnterFileReset: string;
}

export interface SettingsTranslations {
  settingsTitle: string;
  tabExecution: string;
  tabPaths: string;
  tabModels: string;
  tabPreferences: string;
  inputFolders: string;
  btnAddFolder: string;
  btnBrowse: string;
  outputFolder: string;
  modelProvider: string;
  geminiModel: string;
  localModelName: string;
  whisperModel: string;
  preserveStructure: string;
  languageSetting: string;
  languageSettingDesc: string;
  themeSetting: string;
  btnSaveSettings: string;
  btnSavingSettings: string;
  btnClose: string;
  btnResetDefaults: string;
  settingsSavedSuccess: string;
  badgeActiveTab: string;
  badgeCustomPath: string;
  badgeDefaultPath: string;
  inputFoldersDesc: string;
  outputFolderDesc: string;
  maxImagesPerRowLabel: string;
  maxImagesPerRowDesc: string;
  maxDashboardWidthLabel: string;
  maxDashboardWidthDesc: string;
  galleryMaxRowsLabel: string;
  galleryMaxRowsDesc: string;
  promptResetSettingsConfirm: string;
  browserTitle: string;
  browserTitleFile: string;
  btnSelectFolder: string;
  btnSelectFile: string;
  quickLocations: string;
  currentPathLabel: string;
  btnUp: string;
  btnGo: string;
  emptyDirectory: string;
  loadingDirectory: string;
}

export interface LogsTranslations {
  logsTitle: string;
  btnRefreshLogs: string;
  btnRefreshingLogs: string;
  btnClearLogs: string;
  btnSaveLogs: string;
  confirmClearLogs: string;
  autoScroll: string;
  noLogsAvailable: string;
  logsInitMessage: string;
  filterAll: string;
  filterInfo: string;
  filterDebug: string;
  filterWarn: string;
  filterError: string;
  searchLogsPlaceholder: string;
  showErrorDetails: string;
  hideErrorDetails: string;
  stackTraceLabel: string;
  noLogsMatchFilter: string;
  totalEntriesLabel: string;
}

export interface ThemeTranslations {
  tabAppearance: string;
  appearanceTitle: string;
  themeModeLabel: string;
  themePresetsLabel: string;
  themePresetsDesc: string;
  themeMidnight: string;
  themeDaybreak: string;
  themeNordic: string;
  themeSunset: string;
  themeEmerald: string;
  themeSolar: string;
  themeCustom: string;
  modeDark: string;
  modeLight: string;
  themeQuickSwitchTooltip: string;
  themeToggleDarkLight: string;
  customThemeBuilder: string;
  customThemeBuilderDesc: string;
  customThemeName: string;
  customThemeBg: string;
  customThemeCard: string;
  customThemePrimary: string;
  customThemeAccent: string;
  customThemeText: string;
  btnSaveCustomTheme: string;
  btnDeleteCustomTheme: string;
  customThemeCreated: string;
  savedCustomThemes: string;
  noCustomThemes: string;
  confirmDeleteTheme: string;
}

export interface CommonTranslations {
  close: string;
  cancel: string;
  save: string;
  confirm: string;
  delete: string;
  reset: string;
  refresh: string;
  active: string;
  custom: string;
  default: string;
}

export type TranslationDictionary = HeaderTranslations &
  ExecutionControlsTranslations &
  GalleryTranslations &
  LightboxTranslations &
  FaceRegistryTranslations &
  SettingsTranslations &
  ThemeTranslations &
  LogsTranslations &
  CommonTranslations;
