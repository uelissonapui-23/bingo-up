import {Navigate} from 'react-router-dom'
import {useWorkspace} from '@/app/providers/WorkspaceProvider'
import {DashboardPage} from './DashboardPage'
export function RoleHomePage(){const {currentWorkspace}=useWorkspace();if(currentWorkspace?.membership.role==='seller')return <Navigate to="/vendas" replace/>;return <DashboardPage/>}
