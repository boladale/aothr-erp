import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Plus, ArrowRight, Pencil, Trash2, CheckCircle, XCircle,
  GitBranch, Circle, ChevronDown, ChevronUp,
} from "lucide-react";

interface WorkflowState {
  id: string;
  workflow_id: string;
  state_key: string;
  state_label: string;
  state_order: number;
  is_initial: boolean;
  is_terminal: boolean;
  color: string;
}

interface WorkflowTransition {
  id: string;
  workflow_id: string;
  from_state_id: string;
  to_state_id: string;
  action_label: string;
  required_role: string | null;
  conditions: Record<string, unknown>;
  requires_approval: boolean;
}

interface WorkflowAutoAction {
  id: string;
  workflow_id: string;
  trigger_state_id: string;
  action_type: string;
  action_config: Record<string, unknown>;
  is_active: boolean;
}

interface Workflow {
  id: string;
  entity_type: string;
  name: string;
  description: string | null;
  is_active: boolean;
  states: WorkflowState[];
  transitions: WorkflowTransition[];
  auto_actions: WorkflowAutoAction[];
}

const roleLabels: Record<string, string> = {
  admin: "Admin",
  procurement_manager: "Procurement Manager",
  procurement_officer: "Procurement Officer",
  warehouse_manager: "Warehouse Manager",
  warehouse_officer: "Warehouse Officer",
  accounts_payable: "Accounts Payable",
  finance_manager: "Finance Manager",
  sales_manager: "Sales Manager",
  viewer: "Viewer",
};

const stateColors: Record<string, string> = {
  gray: "bg-muted text-muted-foreground",
  yellow: "bg-warning/15 text-warning border border-warning/30",
  green: "bg-success/15 text-success border border-success/30",
  blue: "bg-info/15 text-info border border-info/30",
  red: "bg-destructive/15 text-destructive border border-destructive/30",
};

export default function Workflows() {
  const queryClient = useQueryClient();
  const [expandedWorkflow, setExpandedWorkflow] = useState<string | null>(null);
  const [showCreateWorkflow, setShowCreateWorkflow] = useState(false);
  const [showAddState, setShowAddState] = useState<string | null>(null);
  const [showAddTransition, setShowAddTransition] = useState<string | null>(null);
  const [editingState, setEditingState] = useState<WorkflowState | null>(null);
  const [editingTransition, setEditingTransition] = useState<WorkflowTransition | null>(null);

  // Form states
  const [newWorkflow, setNewWorkflow] = useState({ entity_type: "", name: "", description: "" });
  const [newState, setNewState] = useState({ state_key: "", state_label: "", state_order: 0, is_initial: false, is_terminal: false, color: "gray" });
  const [newTransition, setNewTransition] = useState({ from_state_id: "", to_state_id: "", action_label: "", required_role: "", requires_approval: false });

  const { data: workflows, isLoading } = useQuery({
    queryKey: ["workflows"],
    queryFn: async () => {
      const [wfRes, stRes, trRes, aaRes] = await Promise.all([
        (supabase as any).from("workflows").select("*").order("entity_type"),
        (supabase as any).from("workflow_states").select("*").order("state_order"),
        (supabase as any).from("workflow_transitions").select("*"),
        (supabase as any).from("workflow_auto_actions").select("*"),
      ]);
      if (wfRes.error) throw wfRes.error;
      if (stRes.error) throw stRes.error;
      if (trRes.error) throw trRes.error;
      if (aaRes.error) throw aaRes.error;

      return wfRes.data.map((wf: any) => ({
        ...wf,
        states: stRes.data.filter((s: any) => s.workflow_id === wf.id),
        transitions: trRes.data.filter((t: any) => t.workflow_id === wf.id).map((t: any) => ({
          ...t,
          conditions: (t.conditions || {}) as Record<string, unknown>,
        })),
        auto_actions: aaRes.data.filter((a: any) => a.workflow_id === wf.id).map((a: any) => ({
          ...a,
          action_config: (a.action_config || {}) as Record<string, unknown>,
        })),
      })) as Workflow[];
    },
  });

  const createWorkflowMutation = useMutation({
    mutationFn: async (data: typeof newWorkflow) => {
      const { error } = await (supabase as any).from("workflows").insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      setShowCreateWorkflow(false);
      setNewWorkflow({ entity_type: "", name: "", description: "" });
      toast.success("Workflow created");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleWorkflowActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await (supabase as any).from("workflows").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["workflows"] }),
    onError: (e: any) => toast.error(e.message),
  });

  const deleteWorkflowMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("workflows").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      toast.success("Workflow deleted");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const createStateMutation = useMutation({
    mutationFn: async (data: { workflow_id: string } & typeof newState) => {
      const { error } = await (supabase as any).from("workflow_states").insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      setShowAddState(null);
      setNewState({ state_key: "", state_label: "", state_order: 0, is_initial: false, is_terminal: false, color: "gray" });
      toast.success("State added");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateStateMutation = useMutation({
    mutationFn: async (data: WorkflowState) => {
      const { id, workflow_id: _, ...rest } = data;
      const { error } = await (supabase as any).from("workflow_states").update(rest).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      setEditingState(null);
      toast.success("State updated");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteStateMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("workflow_states").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      toast.success("State deleted");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const createTransitionMutation = useMutation({
    mutationFn: async (data: { workflow_id: string; from_state_id: string; to_state_id: string; action_label: string; required_role: string | null; requires_approval: boolean }) => {
      const { error } = await (supabase as any).from("workflow_transitions").insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      setShowAddTransition(null);
      setNewTransition({ from_state_id: "", to_state_id: "", action_label: "", required_role: "", requires_approval: false });
      toast.success("Transition added");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateTransitionMutation = useMutation({
    mutationFn: async (data: WorkflowTransition) => {
      const { id, workflow_id: _, ...rest } = data;
      const { error } = await (supabase as any).from("workflow_transitions").update(rest).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      setEditingTransition(null);
      toast.success("Transition updated");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteTransitionMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("workflow_transitions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      toast.success("Transition deleted");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const getStateName = (stateId: string, states: WorkflowState[]) =>
    states.find((s) => s.id === stateId)?.state_label || "Unknown";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Workflow Engine"
        description="Define and manage document lifecycle workflows, states, and transitions"
      >
        <Button onClick={() => setShowCreateWorkflow(true)}>
          <Plus className="h-4 w-4 mr-1" /> New Workflow
        </Button>
      </PageHeader>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
      ) : !workflows?.length ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <GitBranch className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">No workflows configured</p>
            <p className="text-sm">Create your first workflow to define document lifecycles.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {workflows.map((wf) => {
            const isExpanded = expandedWorkflow === wf.id;
            return (
              <Card key={wf.id}>
                <CardHeader
                  className="cursor-pointer"
                  onClick={() => setExpandedWorkflow(isExpanded ? null : wf.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <GitBranch className="h-5 w-5 text-primary" />
                      <div>
                        <CardTitle className="text-base">{wf.name}</CardTitle>
                        <CardDescription>{wf.description || wf.entity_type}</CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">{wf.entity_type}</Badge>
                      <Badge variant="secondary">{wf.states.length} states</Badge>
                      <Badge variant="secondary">{wf.transitions.length} transitions</Badge>
                      <Badge variant={wf.is_active ? "default" : "secondary"}>
                        {wf.is_active ? "Active" : "Inactive"}
                      </Badge>
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                  </div>
                </CardHeader>

                {isExpanded && (
                  <CardContent className="space-y-6 border-t pt-6">
                    {/* Visual Flow */}
                    <div>
                      <h4 className="text-sm font-medium mb-3">State Flow</h4>
                      <div className="flex flex-wrap items-center gap-2">
                        {wf.states
                          .sort((a, b) => a.state_order - b.state_order)
                          .map((state, idx) => (
                            <div key={state.id} className="flex items-center gap-2">
                              <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${stateColors[state.color] || stateColors.gray}`}>
                                <Circle className="h-2 w-2 fill-current" />
                                {state.state_label}
                                {state.is_initial && <span className="text-[10px] opacity-70">(start)</span>}
                                {state.is_terminal && <span className="text-[10px] opacity-70">(end)</span>}
                              </div>
                              {idx < wf.states.length - 1 && (
                                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                              )}
                            </div>
                          ))}
                      </div>
                    </div>

                    {/* States Table */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-medium">States</h4>
                        <Button size="sm" variant="outline" onClick={() => {
                          setNewState({ ...newState, state_order: wf.states.length });
                          setShowAddState(wf.id);
                        }}>
                          <Plus className="h-3 w-3 mr-1" /> Add State
                        </Button>
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Order</TableHead>
                            <TableHead>Key</TableHead>
                            <TableHead>Label</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Color</TableHead>
                            <TableHead className="w-20">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {wf.states.sort((a, b) => a.state_order - b.state_order).map((state) => (
                            <TableRow key={state.id}>
                              <TableCell>{state.state_order}</TableCell>
                              <TableCell className="font-mono text-xs">{state.state_key}</TableCell>
                              <TableCell>{state.state_label}</TableCell>
                              <TableCell>
                                {state.is_initial && <Badge variant="outline" className="mr-1">Initial</Badge>}
                                {state.is_terminal && <Badge variant="outline">Terminal</Badge>}
                                {!state.is_initial && !state.is_terminal && <span className="text-muted-foreground text-xs">Intermediate</span>}
                              </TableCell>
                              <TableCell>
                                <span className={`inline-block px-2 py-0.5 rounded text-xs ${stateColors[state.color] || stateColors.gray}`}>{state.color}</span>
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingState(state)}>
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteStateMutation.mutate(state.id)}>
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Transitions Table */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-medium">Transitions</h4>
                        <Button size="sm" variant="outline" onClick={() => setShowAddTransition(wf.id)}>
                          <Plus className="h-3 w-3 mr-1" /> Add Transition
                        </Button>
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>From</TableHead>
                            <TableHead></TableHead>
                            <TableHead>To</TableHead>
                            <TableHead>Action</TableHead>
                            <TableHead>Required Role</TableHead>
                            <TableHead>Approval</TableHead>
                            <TableHead className="w-20">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {wf.transitions.map((tr) => (
                            <TableRow key={tr.id}>
                              <TableCell>{getStateName(tr.from_state_id, wf.states)}</TableCell>
                              <TableCell><ArrowRight className="h-4 w-4 text-muted-foreground" /></TableCell>
                              <TableCell>{getStateName(tr.to_state_id, wf.states)}</TableCell>
                              <TableCell className="font-medium">{tr.action_label}</TableCell>
                              <TableCell>
                                {tr.required_role ? (
                                  <Badge variant="outline">{roleLabels[tr.required_role] || tr.required_role}</Badge>
                                ) : (
                                  <span className="text-muted-foreground text-xs">Any</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {tr.requires_approval ? (
                                  <CheckCircle className="h-4 w-4 text-success" />
                                ) : (
                                  <XCircle className="h-4 w-4 text-muted-foreground" />
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingTransition(tr)}>
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteTransitionMutation.mutate(tr.id)}>
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                          {!wf.transitions.length && (
                            <TableRow>
                              <TableCell colSpan={7} className="text-center text-muted-foreground py-4">
                                No transitions defined
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Workflow actions */}
                    <div className="flex items-center justify-between border-t pt-4">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={wf.is_active}
                          onCheckedChange={(checked) => toggleWorkflowActive.mutate({ id: wf.id, is_active: checked })}
                        />
                        <Label className="text-sm">{wf.is_active ? "Active" : "Inactive"}</Label>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          if (confirm("Delete this workflow and all its states/transitions?")) {
                            deleteWorkflowMutation.mutate(wf.id);
                          }
                        }}
                      >
                        <Trash2 className="h-3 w-3 mr-1" /> Delete Workflow
                      </Button>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Workflow Dialog */}
      <Dialog open={showCreateWorkflow} onOpenChange={setShowCreateWorkflow}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Workflow</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Entity Type</Label>
              <Select value={newWorkflow.entity_type} onValueChange={(v) => setNewWorkflow({ ...newWorkflow, entity_type: v })}>
                <SelectTrigger><SelectValue placeholder="Select entity type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="vendors">Vendors</SelectItem>
                  <SelectItem value="purchase_orders">Purchase Orders</SelectItem>
                  <SelectItem value="ap_invoices">AP Invoices</SelectItem>
                  <SelectItem value="requisitions">Requisitions</SelectItem>
                  <SelectItem value="goods_receipts">Goods Receipts</SelectItem>
                  <SelectItem value="sales_orders">Sales Orders</SelectItem>
                  <SelectItem value="sales_quotations">Sales Quotations</SelectItem>
                  <SelectItem value="ar_invoices">AR Invoices</SelectItem>
                  <SelectItem value="delivery_notes">Delivery Notes</SelectItem>
                  <SelectItem value="journal_entries">Journal Entries</SelectItem>
                  <SelectItem value="chart_of_accounts">Chart of Accounts</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Workflow Name</Label>
              <Input value={newWorkflow.name} onChange={(e) => setNewWorkflow({ ...newWorkflow, name: e.target.value })} placeholder="e.g., Purchase Order Lifecycle" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={newWorkflow.description} onChange={(e) => setNewWorkflow({ ...newWorkflow, description: e.target.value })} placeholder="Describe the workflow..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateWorkflow(false)}>Cancel</Button>
            <Button onClick={() => createWorkflowMutation.mutate(newWorkflow)} disabled={!newWorkflow.entity_type || !newWorkflow.name}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add State Dialog */}
      <Dialog open={!!showAddState} onOpenChange={() => setShowAddState(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingState ? "Edit State" : "Add State"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>State Key</Label>
                <Input value={newState.state_key} onChange={(e) => setNewState({ ...newState, state_key: e.target.value })} placeholder="e.g., draft" />
              </div>
              <div>
                <Label>Display Label</Label>
                <Input value={newState.state_label} onChange={(e) => setNewState({ ...newState, state_label: e.target.value })} placeholder="e.g., Draft" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Order</Label>
                <Input type="number" value={newState.state_order} onChange={(e) => setNewState({ ...newState, state_order: parseInt(e.target.value) || 0 })} />
              </div>
              <div>
                <Label>Color</Label>
                <Select value={newState.color} onValueChange={(v) => setNewState({ ...newState, color: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gray">Gray</SelectItem>
                    <SelectItem value="yellow">Yellow</SelectItem>
                    <SelectItem value="green">Green</SelectItem>
                    <SelectItem value="blue">Blue</SelectItem>
                    <SelectItem value="red">Red</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-6">
              <div className="flex items-center gap-2">
                <Switch checked={newState.is_initial} onCheckedChange={(v) => setNewState({ ...newState, is_initial: v })} />
                <Label>Initial State</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={newState.is_terminal} onCheckedChange={(v) => setNewState({ ...newState, is_terminal: v })} />
                <Label>Terminal State</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddState(null)}>Cancel</Button>
            <Button onClick={() => createStateMutation.mutate({ workflow_id: showAddState!, ...newState })} disabled={!newState.state_key || !newState.state_label}>
              Add State
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit State Dialog */}
      <Dialog open={!!editingState} onOpenChange={() => setEditingState(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit State</DialogTitle>
          </DialogHeader>
          {editingState && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>State Key</Label>
                  <Input value={editingState.state_key} onChange={(e) => setEditingState({ ...editingState, state_key: e.target.value })} />
                </div>
                <div>
                  <Label>Display Label</Label>
                  <Input value={editingState.state_label} onChange={(e) => setEditingState({ ...editingState, state_label: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Order</Label>
                  <Input type="number" value={editingState.state_order} onChange={(e) => setEditingState({ ...editingState, state_order: parseInt(e.target.value) || 0 })} />
                </div>
                <div>
                  <Label>Color</Label>
                  <Select value={editingState.color} onValueChange={(v) => setEditingState({ ...editingState, color: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gray">Gray</SelectItem>
                      <SelectItem value="yellow">Yellow</SelectItem>
                      <SelectItem value="green">Green</SelectItem>
                      <SelectItem value="blue">Blue</SelectItem>
                      <SelectItem value="red">Red</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex gap-6">
                <div className="flex items-center gap-2">
                  <Switch checked={editingState.is_initial} onCheckedChange={(v) => setEditingState({ ...editingState, is_initial: v })} />
                  <Label>Initial State</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={editingState.is_terminal} onCheckedChange={(v) => setEditingState({ ...editingState, is_terminal: v })} />
                  <Label>Terminal State</Label>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingState(null)}>Cancel</Button>
            <Button onClick={() => editingState && updateStateMutation.mutate(editingState)}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Transition Dialog */}
      <Dialog open={!!showAddTransition} onOpenChange={() => setShowAddTransition(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Transition</DialogTitle>
          </DialogHeader>
          {showAddTransition && (
            <div className="space-y-4">
              {(() => {
                const wf = workflows?.find((w) => w.id === showAddTransition);
                const states = wf?.states || [];
                return (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>From State</Label>
                        <Select value={newTransition.from_state_id} onValueChange={(v) => setNewTransition({ ...newTransition, from_state_id: v })}>
                          <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                          <SelectContent>
                            {states.map((s) => <SelectItem key={s.id} value={s.id}>{s.state_label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>To State</Label>
                        <Select value={newTransition.to_state_id} onValueChange={(v) => setNewTransition({ ...newTransition, to_state_id: v })}>
                          <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                          <SelectContent>
                            {states.map((s) => <SelectItem key={s.id} value={s.id}>{s.state_label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label>Action Label</Label>
                      <Input value={newTransition.action_label} onChange={(e) => setNewTransition({ ...newTransition, action_label: e.target.value })} placeholder="e.g., Submit, Approve, Reject" />
                    </div>
                    <div>
                      <Label>Required Role (optional)</Label>
                      <Select value={newTransition.required_role} onValueChange={(v) => setNewTransition({ ...newTransition, required_role: v })}>
                        <SelectTrigger><SelectValue placeholder="Any role" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Any</SelectItem>
                          {Object.entries(roleLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={newTransition.requires_approval} onCheckedChange={(v) => setNewTransition({ ...newTransition, requires_approval: v })} />
                      <Label>Requires Approval</Label>
                    </div>
                  </>
                );
              })()}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddTransition(null)}>Cancel</Button>
            <Button
              onClick={() =>
                createTransitionMutation.mutate({
                  workflow_id: showAddTransition!,
                  from_state_id: newTransition.from_state_id,
                  to_state_id: newTransition.to_state_id,
                  action_label: newTransition.action_label,
                  required_role: newTransition.required_role || null,
                  requires_approval: newTransition.requires_approval,
                })
              }
              disabled={!newTransition.from_state_id || !newTransition.to_state_id || !newTransition.action_label}
            >
              Add Transition
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Transition Dialog */}
      <Dialog open={!!editingTransition} onOpenChange={() => setEditingTransition(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Transition</DialogTitle>
          </DialogHeader>
          {editingTransition && (
            <div className="space-y-4">
              {(() => {
                const wf = workflows?.find((w) => w.id === editingTransition.workflow_id);
                const states = wf?.states || [];
                return (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>From State</Label>
                        <Select value={editingTransition.from_state_id} onValueChange={(v) => setEditingTransition({ ...editingTransition, from_state_id: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {states.map((s) => <SelectItem key={s.id} value={s.id}>{s.state_label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>To State</Label>
                        <Select value={editingTransition.to_state_id} onValueChange={(v) => setEditingTransition({ ...editingTransition, to_state_id: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {states.map((s) => <SelectItem key={s.id} value={s.id}>{s.state_label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label>Action Label</Label>
                      <Input value={editingTransition.action_label} onChange={(e) => setEditingTransition({ ...editingTransition, action_label: e.target.value })} />
                    </div>
                    <div>
                      <Label>Required Role</Label>
                      <Select value={editingTransition.required_role || ""} onValueChange={(v) => setEditingTransition({ ...editingTransition, required_role: v || null })}>
                        <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Any</SelectItem>
                          {Object.entries(roleLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={editingTransition.requires_approval} onCheckedChange={(v) => setEditingTransition({ ...editingTransition, requires_approval: v })} />
                      <Label>Requires Approval</Label>
                    </div>
                  </>
                );
              })()}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTransition(null)}>Cancel</Button>
            <Button onClick={() => editingTransition && updateTransitionMutation.mutate(editingTransition)}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
