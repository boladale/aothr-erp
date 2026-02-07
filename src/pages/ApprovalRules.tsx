import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, FileText, ShoppingCart, CheckCircle, AlertCircle } from "lucide-react";

interface ApprovalStep {
  id: string;
  step_order: number;
  step_type: string;
  approver_role: string | null;
  approver_user_id: string | null;
}

interface ApprovalRule {
  id: string;
  entity_type: string;
  rule_name: string;
  conditions: Record<string, unknown>;
  priority: number;
  is_active: boolean;
  steps: ApprovalStep[];
}

const entityIcons: Record<string, React.ReactNode> = {
  vendors: <Users className="h-4 w-4" />,
  purchase_orders: <ShoppingCart className="h-4 w-4" />,
  ap_invoices: <FileText className="h-4 w-4" />,
};

const entityLabels: Record<string, string> = {
  vendors: "Vendors",
  purchase_orders: "Purchase Orders",
  ap_invoices: "Invoices",
};

const roleLabels: Record<string, string> = {
  admin: "Admin",
  procurement_manager: "Procurement Manager",
  warehouse_manager: "Warehouse Manager",
  accounts_payable: "Accounts Payable",
  viewer: "Viewer",
};

function formatConditions(conditions: Record<string, unknown>): string {
  if (!conditions || Object.keys(conditions).length === 0) {
    return "All";
  }
  
  const parts: string[] = [];
  for (const [field, value] of Object.entries(conditions)) {
    if (typeof value === 'object' && value !== null) {
      const ops = value as Record<string, number>;
      for (const [op, val] of Object.entries(ops)) {
        const opLabel = op === 'gt' ? '>' : op === 'gte' ? '≥' : op === 'lt' ? '<' : op === 'lte' ? '≤' : op;
        const fieldLabel = field === 'total_amount' ? 'Amount' : field;
        parts.push(`${fieldLabel} ${opLabel} $${val.toLocaleString()}`);
      }
    }
  }
  return parts.join(', ') || "All";
}

export default function ApprovalRules() {
  const { data: rules, isLoading } = useQuery({
    queryKey: ['approval-rules'],
    queryFn: async () => {
      // Fetch rules
      const { data: rulesData, error: rulesError } = await supabase
        .from('approval_rules')
        .select('*')
        .order('entity_type')
        .order('priority');
      
      if (rulesError) throw rulesError;
      
      // Fetch steps
      const { data: stepsData, error: stepsError } = await supabase
        .from('approval_steps')
        .select('*')
        .order('step_order');
      
      if (stepsError) throw stepsError;
      
      // Combine rules with their steps
      const rulesWithSteps: ApprovalRule[] = rulesData.map(rule => ({
        ...rule,
        conditions: rule.conditions as Record<string, unknown>,
        steps: stepsData.filter(step => step.rule_id === rule.id),
      }));
      
      return rulesWithSteps;
    },
  });

  // Group rules by entity type
  const groupedRules = rules?.reduce((acc, rule) => {
    if (!acc[rule.entity_type]) {
      acc[rule.entity_type] = [];
    }
    acc[rule.entity_type].push(rule);
    return acc;
  }, {} as Record<string, ApprovalRule[]>) || {};

  return (
    <div className="space-y-6">
      <PageHeader
        title="Approval Rules"
        description="Configure approval workflows for vendors, purchase orders, and invoices"
      />

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedRules).map(([entityType, entityRules]) => (
            <Card key={entityType}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {entityIcons[entityType]}
                  {entityLabels[entityType] || entityType}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rule Name</TableHead>
                      <TableHead>Conditions</TableHead>
                      <TableHead>Approval Levels</TableHead>
                      <TableHead>Approvers</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entityRules.map((rule) => (
                      <TableRow key={rule.id}>
                        <TableCell className="font-medium">
                          {rule.rule_name}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {formatConditions(rule.conditions)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {rule.steps.length} level{rule.steps.length !== 1 ? 's' : ''}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            {rule.steps.map((step) => (
                              <div key={step.id} className="flex items-center gap-2 text-sm">
                                <span className="text-muted-foreground">
                                  {step.step_order}.
                                </span>
                                <span>
                                  {step.approver_role 
                                    ? roleLabels[step.approver_role] || step.approver_role
                                    : 'Specific User'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          {rule.is_active ? (
                            <Badge variant="default">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="secondary">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              Inactive
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
