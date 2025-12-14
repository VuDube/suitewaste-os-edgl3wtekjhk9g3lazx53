import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageLayout } from '@/components/PageLayout';
import { api } from '@/lib/api-client';
import type { User, EPRReport, ConfigUserUpdate } from '@shared/types';
import { useAuthStore } from '@/stores/useAuthStore';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ShieldAlert, Download, Save, Loader2, PieChart as PieChartIcon } from 'lucide-react';
import { toast } from 'sonner';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
const COLORS = ['#38761d', '#5a9a47', '#7cb870', '#a0d69a', '#c5f4c3', '#e7f9e6'];
function UserRolesTable() {
  const queryClient = useQueryClient();
  const { data: users, isLoading } = useQuery({
    queryKey: ['config-users'],
    queryFn: () => api<Omit<User, 'password_hash'>[]>('/api/config/users'),
  });
  const [userChanges, setUserChanges] = useState<Map<string, ConfigUserUpdate>>(new Map());
  const mutation = useMutation({
    mutationFn: (updates: ConfigUserUpdate[]) => api('/api/config/users', {
      method: 'POST',
      body: JSON.stringify(updates),
    }),
    onSuccess: () => {
      toast.success('User configurations saved successfully!');
      setUserChanges(new Map());
      queryClient.invalidateQueries({ queryKey: ['config-users'] });
    },
    onError: (error) => {
      toast.error('Failed to save changes', { description: error.message });
    },
  });
  const handleRoleChange = (userId: string, role: User['role']) => {
    setUserChanges(prev => new Map(prev).set(userId, { ...prev.get(userId), id: userId, role }));
  };
  const handleActiveChange = (userId: string, active: boolean) => {
    setUserChanges(prev => new Map(prev).set(userId, { ...prev.get(userId), id: userId, active }));
  };
  const handleSaveChanges = () => {
    mutation.mutate(Array.from(userChanges.values()));
  };
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>User Role Management</CardTitle>
        <Button onClick={handleSaveChanges} disabled={userChanges.size === 0 || mutation.isPending}>
          {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save Changes
        </Button>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto border rounded-lg">
          <Table>
            <TableHeader><TableRow><TableHead>Username</TableHead><TableHead>Role</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {isLoading ? <TableRow><TableCell colSpan={3} className="text-center">Loading users...</TableCell></TableRow>
               : users?.map(user => {
                  const changes = userChanges.get(user.id);
                  const currentRole = changes?.role ?? user.role;
                  const currentStatus = changes?.active ?? user.active;
                  return (
                    <TableRow key={user.id}>
                      <TableCell>{user.username}</TableCell>
                      <TableCell>
                        <Select value={currentRole} onValueChange={(role: User['role']) => handleRoleChange(user.id, role)}>
                          <SelectTrigger className="w-[180px] h-10"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="operator">Operator</SelectItem>
                            <SelectItem value="manager">Manager</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="auditor">Auditor</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Switch checked={currentStatus} onCheckedChange={(active) => handleActiveChange(user.id, active)} />
                      </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
function EprReportingTab() {
  const { data: report, isLoading } = useQuery({
    queryKey: ['epr-report'],
    queryFn: () => api<EPRReport>('/api/epr-report'),
  });
  const streamData = report ? Object.entries(report.streams).map(([name, data]) => ({ name, ...data })) : [];
  const handleExportXml = () => {
    toast.info("PRO XML Export", { description: "This is a mock export. In production, this would download a compliant XML file." });
  };
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="lg:col-span-1">
        <CardHeader><CardTitle>Compliance Overview</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center">
            <div className="text-4xl font-bold">{report?.compliance_pct.toFixed(1) ?? '...'}%</div>
            <p className="text-sm text-muted-foreground">WEEE Compliant Suppliers</p>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold">R {report?.total_fees.toFixed(2) ?? '...'}</div>
            <p className="text-sm text-muted-foreground">Total EPR Fees Collected</p>
          </div>
          <Button onClick={handleExportXml} className="w-full h-14"><Download className="mr-2 h-4 w-4" /> Export PRO XML</Button>
        </CardContent>
      </Card>
      <Card className="lg:col-span-2">
        <CardHeader><CardTitle>Weight by EPR Stream (kg)</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={streamData} dataKey="weight" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                {streamData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
export function Settings() {
  const user = useAuthStore(s => s.user);
  if (user?.role !== 'admin') {
    return (
      <PageLayout>
        <Alert variant="destructive" className="max-w-2xl mx-auto">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>You do not have the required permissions to access the settings page.</AlertDescription>
        </Alert>
      </PageLayout>
    );
  }
  return (
    <PageLayout>
      <div className="space-y-8">
        <h1 className="text-3xl font-bold tracking-tight">System Settings</h1>
        <Tabs defaultValue="roles" className="w-full">
          <TabsList className="grid w-full grid-cols-2 md:w-[400px]">
            <TabsTrigger value="roles">Role Configuration</TabsTrigger>
            <TabsTrigger value="epr">EPR Reporting</TabsTrigger>
          </TabsList>
          <TabsContent value="roles" className="mt-6">
            <UserRolesTable />
          </TabsContent>
          <TabsContent value="epr" className="mt-6">
            <EprReportingTab />
          </TabsContent>
        </Tabs>
      </div>
    </PageLayout>
  );
}