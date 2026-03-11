import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { ArrowLeft, Send, Award, UserPlus, Star, Pencil } from 'lucide-react';
import { RFPEditDialog } from '@/components/rfp/RFPEditDialog';
import { format } from 'date-fns';
import { formatCurrency } from '@/lib/currency';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

interface RFPData {
  id: string;
  rfp_number: string;
  title: string;
  description: string | null;
  status: string;
  deadline: string | null;
  created_by: string | null;
  created_at: string;
  awarded_vendor_id: string | null;
  awarded_proposal_id: string | null;
}

interface RFPItem {
  id: string;
  item_id: string;
  quantity: number;
  specifications: string | null;
  items: { code: string; name: string; category: string | null } | null;
}

interface Criterion {
  id: string;
  criterion_name: string;
  weight: number;
  description: string | null;
}

interface Proposal {
  id: string;
  vendor_id: string;
  status: string;
  total_amount: number;
  delivery_timeline_days: number | null;
  cover_letter: string | null;
  submitted_at: string | null;
  weighted_score: number;
  vendors: { code: string; name: string; service_categories: string[] | null; project_size_capacity: string | null } | null;
}

interface Vendor {
  id: string;
  code: string;
  name: string;
  status: string;
  service_categories: string[] | null;
  project_size_capacity: string | null;
}

interface Score {
  id: string;
  proposal_id: string;
  criterion_id: string;
  score: number;
  comments: string | null;
}

export default function RFPDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [rfp, setRfp] = useState<RFPData | null>(null);
  const [rfpItems, setRfpItems] = useState<RFPItem[]>([]);
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [scores, setScores] = useState<Score[]>([]);
  const [loading, setLoading] = useState(true);

  // Invite dialog state
  const [inviteOpen, setInviteOpen] = useState(false);
  const [availableVendors, setAvailableVendors] = useState<Vendor[]>([]);
  const [qualifiedVendors, setQualifiedVendors] = useState<Vendor[]>([]);

  // Score editing
  const [editingScores, setEditingScores] = useState<Record<string, Record<string, number>>>({});
  const [scoreComments, setScoreComments] = useState<Record<string, Record<string, string>>>({});

  const fetchData = useCallback(async () => {
    if (!id) return;
    try {
      const [rfpRes, itemsRes, criteriaRes, proposalsRes, scoresRes] = await Promise.all([
        supabase.from('rfps').select('*').eq('id', id).single(),
        supabase.from('rfp_items').select('*, items(code, name, category)').eq('rfp_id', id),
        supabase.from('rfp_criteria').select('*').eq('rfp_id', id),
        supabase.from('rfp_proposals').select('*, vendors(code, name, service_categories, project_size_capacity)').eq('rfp_id', id),
        supabase.from('rfp_scores').select('*'),
      ]);

      if (rfpRes.error) throw rfpRes.error;
      setRfp(rfpRes.data as unknown as RFPData);
      setRfpItems((itemsRes.data || []) as unknown as RFPItem[]);
      setCriteria((criteriaRes.data || []) as unknown as Criterion[]);
      setProposals((proposalsRes.data || []) as unknown as Proposal[]);

      // Filter scores for this RFP's proposals
      const proposalIds = (proposalsRes.data || []).map((p: { id: string }) => p.id);
      const rfpScores = (scoresRes.data || []).filter((s: { proposal_id: string }) => proposalIds.includes(s.proposal_id));
      setScores(rfpScores as unknown as Score[]);

      // Init score editing state
      const scoreMap: Record<string, Record<string, number>> = {};
      const commentMap: Record<string, Record<string, string>> = {};
      rfpScores.forEach((s: Score) => {
        if (!scoreMap[s.proposal_id]) scoreMap[s.proposal_id] = {};
        if (!commentMap[s.proposal_id]) commentMap[s.proposal_id] = {};
        scoreMap[s.proposal_id][s.criterion_id] = s.score;
        commentMap[s.proposal_id][s.criterion_id] = s.comments || '';
      });
      setEditingScores(scoreMap);
      setScoreComments(commentMap);
    } catch (error) {
      console.error(error);
      toast.error('Failed to load RFP details');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handlePublish = async () => {
    if (!rfp || proposals.length === 0) {
      toast.error('Invite at least one vendor before publishing');
      return;
    }
    const { error } = await supabase.from('rfps').update({ status: 'published' }).eq('id', rfp.id);
    if (error) { toast.error(error.message); return; }
    toast.success('RFP published and vendors notified');
    fetchData();
  };

  const handleStartEvaluation = async () => {
    if (!rfp) return;
    const { error } = await supabase.from('rfps').update({ status: 'evaluating' }).eq('id', rfp.id);
    if (error) { toast.error(error.message); return; }
    toast.success('Evaluation phase started');
    fetchData();
  };

  const openInviteDialog = async () => {
    // Get all active vendors
    const { data: vendors } = await supabase.from('vendors').select('*').eq('status', 'active');
    const allVendors = (vendors || []) as unknown as Vendor[];

    // Get item categories for this RFP
    const itemCategories = rfpItems
      .map(i => i.items?.category)
      .filter(Boolean)
      .map(c => c!.toLowerCase());

    // Get already-invited vendor IDs
    const invitedIds = proposals.map(p => p.vendor_id);

    // Filter qualified vendors: matching category, not already invited
    const qualified = allVendors.filter(v => {
      if (invitedIds.includes(v.id)) return false;
      const vendorCats = (v.service_categories || []).map(c => c.toLowerCase());
      const categoryMatch = itemCategories.length === 0 || itemCategories.some(ic => vendorCats.some(vc => vc.includes(ic) || ic.includes(vc)));
      return categoryMatch;
    });

    const others = allVendors.filter(v => !invitedIds.includes(v.id) && !qualified.some(q => q.id === v.id));

    setQualifiedVendors(qualified);
    setAvailableVendors(others);
    setInviteOpen(true);
  };

  const inviteVendor = async (vendorId: string) => {
    if (!rfp) return;
    const { error } = await supabase.from('rfp_proposals').insert({
      rfp_id: rfp.id,
      vendor_id: vendorId,
      status: 'invited',
    });
    if (error) { toast.error(error.message); return; }
    toast.success('Vendor invited');
    setInviteOpen(false);
    fetchData();
  };

  const handleRecordProposal = async (proposal: Proposal) => {
    // Mark proposal as submitted (in real scenario vendor would submit)
    const { error } = await supabase.from('rfp_proposals')
      .update({ status: 'submitted', submitted_at: new Date().toISOString() })
      .eq('id', proposal.id);
    if (error) { toast.error(error.message); return; }
    toast.success('Proposal marked as submitted');
    fetchData();
  };

  const updateProposalAmount = async (proposalId: string, amount: number, days: number | null) => {
    const { error } = await supabase.from('rfp_proposals')
      .update({ total_amount: amount, delivery_timeline_days: days })
      .eq('id', proposalId);
    if (error) toast.error(error.message);
  };

  const handleSaveScores = async (proposalId: string) => {
    const proposalScores = editingScores[proposalId] || {};
    const proposalComments = scoreComments[proposalId] || {};

    try {
      for (const criterion of criteria) {
        const score = proposalScores[criterion.id] ?? 0;
        const comments = proposalComments[criterion.id] || null;

        await supabase.from('rfp_scores').upsert({
          proposal_id: proposalId,
          criterion_id: criterion.id,
          score,
          comments,
          evaluated_by: user?.id,
        }, { onConflict: 'proposal_id,criterion_id' });
      }

      // Calculate weighted score
      let weightedScore = 0;
      for (const criterion of criteria) {
        const score = proposalScores[criterion.id] ?? 0;
        weightedScore += (score / 10) * criterion.weight;
      }

      await supabase.from('rfp_proposals')
        .update({ weighted_score: weightedScore })
        .eq('id', proposalId);

      toast.success('Scores saved');
      fetchData();
    } catch (error) {
      toast.error('Failed to save scores');
    }
  };

  const handleAward = async (proposal: Proposal) => {
    if (!rfp) return;
    try {
      // Update RFP
      await supabase.from('rfps').update({
        status: 'awarded',
        awarded_vendor_id: proposal.vendor_id,
        awarded_proposal_id: proposal.id,
      }).eq('id', rfp.id);

      // Update winning proposal
      await supabase.from('rfp_proposals')
        .update({ status: 'awarded' })
        .eq('id', proposal.id);

      // Reject others
      await supabase.from('rfp_proposals')
        .update({ status: 'rejected' })
        .eq('rfp_id', rfp.id)
        .neq('id', proposal.id)
        .in('status', ['submitted']);

      toast.success(`Awarded to ${proposal.vendors?.name}`);
      fetchData();
    } catch (error) {
      toast.error('Failed to award RFP');
    }
  };

  if (loading) return <AppLayout><div className="page-container"><p>Loading...</p></div></AppLayout>;
  if (!rfp) return <AppLayout><div className="page-container"><p>RFP not found</p></div></AppLayout>;

  const sortedProposals = [...proposals].sort((a, b) => b.weighted_score - a.weighted_score);

  return (
    <AppLayout>
      <div className="page-container">
        <Button variant="ghost" onClick={() => navigate('/rfps')} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to RFPs
        </Button>

        <PageHeader
          title={`${rfp.rfp_number} — ${rfp.title}`}
          description={rfp.description || ''}
          actions={
            <div className="flex gap-2">
              {rfp.status === 'draft' && (
                <>
                  <Button variant="outline" onClick={openInviteDialog}>
                    <UserPlus className="mr-2 h-4 w-4" /> Invite Vendors
                  </Button>
                  <Button onClick={handlePublish}>
                    <Send className="mr-2 h-4 w-4" /> Publish RFP
                  </Button>
                </>
              )}
              {rfp.status === 'published' && (
                <Button onClick={handleStartEvaluation}>
                  <Star className="mr-2 h-4 w-4" /> Start Evaluation
                </Button>
              )}
            </div>
          }
        />

        <div className="flex gap-4 mb-6">
          <Badge variant="outline">Status: <StatusBadge status={rfp.status} /></Badge>
          {rfp.deadline && <Badge variant="outline">Deadline: {format(new Date(rfp.deadline), 'dd MMM yyyy HH:mm')}</Badge>}
          <Badge variant="secondary">{proposals.length} Vendor(s) Invited</Badge>
        </div>

        <Tabs defaultValue="items">
          <TabsList>
            <TabsTrigger value="items">Items ({rfpItems.length})</TabsTrigger>
            <TabsTrigger value="criteria">Criteria ({criteria.length})</TabsTrigger>
            <TabsTrigger value="proposals">Proposals ({proposals.length})</TabsTrigger>
            {rfp.status === 'evaluating' && <TabsTrigger value="evaluation">Evaluation</TabsTrigger>}
          </TabsList>

          <TabsContent value="items">
            <Card>
              <CardHeader><CardTitle>Required Items</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Specifications</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rfpItems.map(item => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.items?.code} - {item.items?.name}</TableCell>
                        <TableCell>{item.items?.category || '-'}</TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell>{item.specifications || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="criteria">
            <Card>
              <CardHeader><CardTitle>Evaluation Criteria</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Criterion</TableHead>
                      <TableHead>Weight</TableHead>
                      <TableHead>Description</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {criteria.map(c => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.criterion_name}</TableCell>
                        <TableCell><Badge>{c.weight}%</Badge></TableCell>
                        <TableCell>{c.description || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="proposals">
            <Card>
              <CardHeader><CardTitle>Vendor Proposals</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vendor</TableHead>
                      <TableHead>Categories</TableHead>
                      <TableHead>Capacity</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Delivery (days)</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedProposals.map(p => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.vendors?.name}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {(p.vendors?.service_categories || []).slice(0, 2).map(c => (
                              <Badge key={c} variant="secondary" className="text-xs">{c}</Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>{p.vendors?.project_size_capacity || '-'}</TableCell>
                        <TableCell><StatusBadge status={p.status} /></TableCell>
                        <TableCell>
                          {rfp.status !== 'awarded' && p.status !== 'awarded' ? (
                            <Input
                              type="number"
                              className="w-28"
                              defaultValue={p.total_amount}
                              onBlur={e => updateProposalAmount(p.id, Number(e.target.value), p.delivery_timeline_days)}
                            />
                          ) : (
                            formatCurrency(p.total_amount)
                          )}
                        </TableCell>
                        <TableCell>
                          {rfp.status !== 'awarded' && p.status !== 'awarded' ? (
                            <Input
                              type="number"
                              className="w-20"
                              defaultValue={p.delivery_timeline_days || ''}
                              onBlur={e => updateProposalAmount(p.id, p.total_amount, Number(e.target.value) || null)}
                            />
                          ) : (
                            p.delivery_timeline_days || '-'
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="font-semibold">{p.weighted_score.toFixed(1)}%</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {p.status === 'invited' && (
                              <Button size="sm" variant="outline" onClick={() => handleRecordProposal(p)}>
                                Record Submission
                              </Button>
                            )}
                            {rfp.status === 'evaluating' && p.status === 'submitted' && (
                              <Button size="sm" onClick={() => handleAward(p)}>
                                <Award className="h-3 w-3 mr-1" /> Award
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="evaluation">
            <div className="space-y-6">
              {sortedProposals.filter(p => p.status === 'submitted').map(proposal => (
                <Card key={proposal.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>{proposal.vendors?.name} — Score: {proposal.weighted_score.toFixed(1)}%</CardTitle>
                      <Button size="sm" onClick={() => handleSaveScores(proposal.id)}>Save Scores</Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Criterion</TableHead>
                          <TableHead>Weight</TableHead>
                          <TableHead>Score (0-10)</TableHead>
                          <TableHead>Weighted</TableHead>
                          <TableHead>Comments</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {criteria.map(c => {
                          const score = editingScores[proposal.id]?.[c.id] ?? 0;
                          const weighted = (score / 10) * c.weight;
                          return (
                            <TableRow key={c.id}>
                              <TableCell className="font-medium">{c.criterion_name}</TableCell>
                              <TableCell>{c.weight}%</TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  min={0}
                                  max={10}
                                  className="w-20"
                                  value={score}
                                  onChange={e => {
                                    const val = Math.min(10, Math.max(0, Number(e.target.value)));
                                    setEditingScores(prev => ({
                                      ...prev,
                                      [proposal.id]: { ...prev[proposal.id], [c.id]: val }
                                    }));
                                  }}
                                />
                              </TableCell>
                              <TableCell>{weighted.toFixed(1)}%</TableCell>
                              <TableCell>
                                <Input
                                  value={scoreComments[proposal.id]?.[c.id] || ''}
                                  onChange={e => {
                                    setScoreComments(prev => ({
                                      ...prev,
                                      [proposal.id]: { ...prev[proposal.id], [c.id]: e.target.value }
                                    }));
                                  }}
                                  placeholder="Comments"
                                />
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        {/* Invite Dialog */}
        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
          <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Invite Vendors</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {qualifiedVendors.length > 0 && (
                <div>
                  <Label className="text-sm font-semibold text-success">Qualified Vendors (Category Match)</Label>
                  <div className="space-y-2 mt-2">
                    {qualifiedVendors.map(v => (
                      <div key={v.id} className="flex items-center justify-between p-3 rounded-lg border border-success/30 bg-success/5">
                        <div>
                          <p className="font-medium">{v.name}</p>
                          <div className="flex gap-1 mt-1">
                            {(v.service_categories || []).map(c => (
                              <Badge key={c} variant="secondary" className="text-xs">{c}</Badge>
                            ))}
                          </div>
                        </div>
                        <Button size="sm" onClick={() => inviteVendor(v.id)}>Invite</Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {availableVendors.length > 0 && (
                <div>
                  <Label className="text-sm font-semibold text-muted-foreground">Other Active Vendors</Label>
                  <div className="space-y-2 mt-2">
                    {availableVendors.map(v => (
                      <div key={v.id} className="flex items-center justify-between p-3 rounded-lg border">
                        <div>
                          <p className="font-medium">{v.name}</p>
                          <div className="flex gap-1 mt-1">
                            {(v.service_categories || []).map(c => (
                              <Badge key={c} variant="outline" className="text-xs">{c}</Badge>
                            ))}
                          </div>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => inviteVendor(v.id)}>Invite</Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {qualifiedVendors.length === 0 && availableVendors.length === 0 && (
                <p className="text-muted-foreground text-sm">No available vendors to invite.</p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setInviteOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
