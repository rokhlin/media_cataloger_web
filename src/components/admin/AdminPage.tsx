import { Navigate } from 'react-router-dom';
import { useAuth } from '../../services/authContext';
import AdminPanel from './AdminPanel';

export default function AdminPage() {
  const { isAdmin } = useAuth();

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="h-full">
      <AdminPanel />
    </div>
  );
}
