"""Signed-in integration regression for Learnsoft's cash reconciliation.

Run after selecting the current preview account with `lovable auth-session`:
python3 src/test/cash_position_regression.py
No credentials or financial records are written by these checks.
"""

import asyncio
from decimal import Decimal

from lovable_playwright_defaults import signed_in_context
from playwright.async_api import async_playwright


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await signed_in_context(browser)
        page = await context.new_page()
        await page.goto("http://localhost:8080/ask-aothr", wait_until="networkidle")
        await page.get_by_role("heading", name="Ask Aothr", exact=True).wait_for()
        result = await page.evaluate("""async () => {
          const { supabase } = await import('/src/integrations/supabase/client.ts');
          const { data: { user } } = await supabase.auth.getUser();
          if (!user || user.email !== 'boladale.kolade@ifain.org')
            throw new Error('Select the Learnsoft preview account before testing');
          const { data, error } = await supabase.rpc('ai_cash_position');
          if (error) throw new Error(error.message);
          return data;
        }""")
        groups = result["ledger_groups"]
        ids = [g["gl_account_id"] for g in groups]
        assert len(ids) == len(set(ids)), "Each ledger must appear only once"
        total = sum(Decimal(str(g["ledger_balance"] or 0)) for g in groups)
        assert Decimal(str(result["total_cash_ledger"])) == total
        assert total == Decimal("66722675"), "Count bank ledger once plus owner's petty-cash funds"
        assert Decimal(str(result["total_cash_book"])) == Decimal("66722675")
        assert Decimal(str(result["difference"])) == 0
        shared = next(g for g in groups if g["account_code"] == "1200")
        assert shared["bank_account_count"] == 2
        assert Decimal(str(shared["difference"])) == 0
        for account in result["accounts"]:
            if account["shared_ledger"]:
                assert account["ledger_balance"] is None
                assert account["difference"] is None
        petty = next(g for g in groups if g["account_code"] == "1110")
        assert Decimal(str(petty["book_balance"])) == Decimal("100000")
        assert Decimal(str(petty["ledger_balance"])) == Decimal("100000")
        assert Decimal(str(petty["difference"])) == 0
        assert petty["reconciliation_status"] == "balanced"
        correction = await page.evaluate("""async () => {
          const { supabase } = await import('/src/integrations/supabase/client.ts');
          const { data, error } = await supabase.from('gl_journal_entries')
            .select('status,total_debit,total_credit,gl_journal_lines(debit,credit)')
            .eq('source_module','opening_cash_reconciliation')
            .eq('source_id','a9a1bb12-bc42-41be-aef7-377a08ce194d');
          if (error) throw new Error(error.message);
          return data;
        }""")
        assert len(correction) == 1, "Owner contribution must be recorded once only"
        assert correction[0]["status"] == "posted"
        assert Decimal(str(correction[0]["total_debit"])) == Decimal("100000")
        assert Decimal(str(correction[0]["total_credit"])) == Decimal("100000")
        assert len(correction[0]["gl_journal_lines"]) == 2
        print("PASS: distinct ledger total, shared-bank group, balanced owner funds and zero variance")
        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())