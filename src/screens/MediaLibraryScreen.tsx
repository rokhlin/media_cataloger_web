import FaceRegistry, {
  type FaceRegistryFace,
  type FaceRegistryPerson,
  type FaceRegistryGroup,
} from '../components/faces';
import ExecutionControls from '../components/settings/ExecutionControls';
import type { UISettings } from '../models';

export interface MediaLibraryScreenProps {
  faces: Array<{ face_id: string; name?: string }>;
  persons: FaceRegistryPerson[];
  unrecognizedFaces: FaceRegistryFace[];
  unrecognizedGroups: FaceRegistryGroup[];
  isLoading: boolean;
  error: string | null;
  onRenameFace: (faceId: string, newName: string) => Promise<boolean>;
  onAssignFace: (faceId: string, personName: string, personId?: string) => Promise<boolean>;
  onAssignGroup: (faceIds: string[], personName: string, personId?: string) => Promise<boolean>;
  onResetFace: (faceId: string) => Promise<boolean>;
  onResetFacesByFilename: (filename: string) => Promise<boolean>;
  onDeleteFace: (faceId: string) => Promise<boolean>;
  onDeleteFacesBatch: (faceIds: string[]) => Promise<boolean>;
  disabled?: boolean;
  uiSettings: UISettings;
  onViewInFamilyTree?: (personName: string, personId?: string) => void;
  // Execution Controls props
  isRunning: boolean;
  isPaused: boolean;
  currentTask: string | null | undefined;
  onStartSync: (force: boolean) => void;
  onPauseSync: () => void;
  onResumeSync: () => void;
  onStopSync: () => void;
  onStartSingleAnalysis: (filePath: string) => void;
  onPickSingleFile: () => Promise<string>;
  pickerPending: boolean;
}

export default function MediaLibraryScreen({
  faces,
  persons,
  unrecognizedFaces,
  unrecognizedGroups,
  isLoading,
  error,
  onRenameFace,
  onAssignFace,
  onAssignGroup,
  onResetFace,
  onResetFacesByFilename,
  onDeleteFace,
  onDeleteFacesBatch,
  disabled,
  uiSettings,
  onViewInFamilyTree,
  isRunning,
  isPaused,
  currentTask,
  onStartSync,
  onPauseSync,
  onResumeSync,
  onStopSync,
  onStartSingleAnalysis,
  onPickSingleFile,
  pickerPending,
}: MediaLibraryScreenProps) {
  return (
    <div className="tab-pane active media-library-layout" id="pane-media-library">
      <FaceRegistry
        faces={faces}
        persons={persons}
        unrecognizedFaces={unrecognizedFaces}
        unrecognizedGroups={unrecognizedGroups}
        isLoading={isLoading}
        error={error}
        onRenameFace={onRenameFace}
        onAssignFace={onAssignFace}
        onAssignGroup={onAssignGroup}
        onResetFace={onResetFace}
        onResetFacesByFilename={onResetFacesByFilename}
        onDeleteFace={onDeleteFace}
        onDeleteFacesBatch={onDeleteFacesBatch}
        disabled={disabled}
        uiSettings={uiSettings}
        onViewInFamilyTree={onViewInFamilyTree}
      />

      <ExecutionControls
        isRunning={isRunning}
        isPaused={isPaused}
        currentTask={currentTask}
        onStartSync={onStartSync}
        onPauseSync={onPauseSync}
        onResumeSync={onResumeSync}
        onStopSync={onStopSync}
        onStartSingleAnalysis={onStartSingleAnalysis}
        onPickSingleFile={onPickSingleFile}
        pickerPending={pickerPending}
      />
    </div>
  );
}

export { MediaLibraryScreen };
