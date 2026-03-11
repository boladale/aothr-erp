import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface GeneratePeriodsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingYears: number[];
  onGenerated: () => void;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function GeneratePeriodsDialog({
  open,
  onOpenChange,
  existingYears,
  onGenerated,
}: GeneratePeriodsDialogProps) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState<string>(currentYear.toString());
  const [startMonth, setStartMonth] = useState<string>('1'); // Jan-Dec default
  const [generating, setGenerating] = useState(false);

  const yearNum = parseInt(year);
  const yearAlreadyExists = existingYears.includes(yearNum);

  const handleGenerate = async () => {
    if (!year || yearAlreadyExists) return;
    setGenerating(true);

    try {
      const startM = parseInt(startMonth);
      const periods = [];

      for (let i = 0; i < 12; i++) {
        const monthIndex = ((startM - 1 + i) % 12); // 0-based month
        const periodYear = startM + i > 12 ? yearNum + 1 : yearNum;
        const actualYear = Math.floor((startM - 1 + i) / 12) + yearNum;
        const actualMonth = monthIndex; // 0-based for Date constructor

        const startDate = new Date(actualYear, actualMonth, 1);
        const endDate = new Date(actualYear, actualMonth + 1, 0); // last day of month

        const periodName = `${MONTH_NAMES[monthIndex]} ${actualYear}`;
        const startDateStr = startDate.toISOString().split('T')[0];
        const endDateStr = endDate.toISOString().split('T')[0];

        periods.push({
          fiscal_year: yearNum,
          period_number: i + 1,
          period_name: periodName,
          start_date: startDateStr,
          end_date: endDateStr,
          status: 'open' as const,
        });
      }

      const { error } = await supabase.from('gl_fiscal_periods').insert(periods as any);
      if (error) throw error;

      toast.success(`Generated 12 fiscal periods for FY${yearNum}`);
      onOpenChange(false);
      onGenerated();
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate periods');
    } finally {
      setGenerating(false);
    }
  };

  // Suggest years: current-1, current, current+1, current+2
  const suggestedYears = [currentYear - 1, currentYear, currentYear + 1, currentYear + 2];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generate Fiscal Periods</DialogTitle>
          <DialogDescription>
            Create 12 monthly periods for a fiscal year. All periods will be created with "Open" status, ready for transactions.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div>
            <Label>Fiscal Year</Label>
            <Input
              type="number"
              min={2000}
              max={2100}
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="mt-1"
            />
            {yearAlreadyExists && (
              <p className="text-sm text-destructive mt-1">
                Periods for FY{yearNum} already exist. Choose a different year.
              </p>
            )}
            <div className="flex gap-1 mt-2">
              {suggestedYears.map((y) => (
                <Button
                  key={y}
                  variant={year === y.toString() ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setYear(y.toString())}
                  disabled={existingYears.includes(y)}
                >
                  {y}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <Label>Fiscal Year Starts In</Label>
            <Select value={startMonth} onValueChange={setStartMonth}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTH_NAMES.map((name, idx) => (
                  <SelectItem key={idx + 1} value={(idx + 1).toString()}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Most organizations use January. Some use April, July, or October.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={!year || yearAlreadyExists || generating}
          >
            {generating ? 'Generating...' : `Generate 12 Periods for FY${year}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
