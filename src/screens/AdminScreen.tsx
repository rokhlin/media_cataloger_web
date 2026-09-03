import AdminPanel from '../components/admin';
import type { StatusInfo, UISettings, GalleryMediaFile } from '../models';

export interface AdminScreenProps {
  canAccessAdmin: boolean;
  onOpenLogin: () => void;
  statusInfo: StatusInfo;
  mediaFilesCount: number;
  facesCount: number;
  mediaFiles: GalleryMediaFile[];
  onRefreshMedia: (force?: boolean) => void | Promise<void>;
  onStartSingleAnalysis: (
    filePath: string,
    onSuccess?: () => void,
    onError?: (errMsg: string) => void
  ) => Promise<boolean | void> | void;
  uiSettings: UISettings;
  onReloadFaces: () => Promise<void>;
  onViewInFamilyTree: (personName: string, personId?: string) => void;
}

export default function AdminScreen({
  canAccessAdmin,
  onOpenLogin,
  statusInfo,
  mediaFilesCount,
  facesCount,
  mediaFiles,
  onRefreshMedia,
  onStartSingleAnalysis,
  uiSettings,
  onReloadFaces,
  onViewInFamilyTree,
}: AdminScreenProps) {
  return (
    <div className="tab-pane active" id="pane-admin">
      {!canAccessAdmin ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '60vh',
            gap: '1.25rem',
            textAlign: 'center',
            background: 'rgba(0, 0, 0, 0.25)',
            borderRadius: '16px',
            border: '1px dashed rgba(239, 68, 68, 0.3)',
            padding: '2rem',
          }}
        >
          <span style={{ fontSize: '3.5rem' }}>🛡️</span>
          <div>
            <h2 style={{ margin: '0 0 0.5rem', color: '#fff' }}>Administrator Privileges Required</h2>
            <p style={{ margin: 0, color: '#9aa0a6', maxWidth: '420px' }}>
              You need to sign in with an Administrator account to configure feature flags, system parameters, and manage users.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onOpenLogin}
            style={{ padding: '0.75rem 1.75rem', fontSize: '1rem', borderRadius: '12px' }}
            id="btn-admin-signin"
          >
            🔑 Sign In as Admin
          </button>
        </div>
      ) : (
        <AdminPanel
          statusInfo={statusInfo}
          mediaFilesCount={mediaFilesCount}
          facesCount={facesCount}
          mediaFiles={mediaFiles}
          onRefreshMedia={onRefreshMedia}
          onStartSingleAnalysis={onStartSingleAnalysis}
          uiSettings={uiSettings}
          onReloadFaces={onReloadFaces}
          onViewInFamilyTree={onViewInFamilyTree}
        />
      )}
    </div>
  );
}

export { AdminScreen };
