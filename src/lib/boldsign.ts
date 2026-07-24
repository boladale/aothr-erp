import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { supabase } from '@/integrations/supabase/client';

export type SignableDocumentType =
  | 'purchase_order'
  | 'rfq'
  | 'vendor_contract'
  | 'fixed_asset_disposal';

export interface SendForSignatureArgs {
  documentType: SignableDocumentType;
  documentId: string;
  documentNumber?: string;
  signerName: string;
  signerEmail: string;
  title: string;
  message?: string;
  pdfBase64: string; // base64 (no data: prefix required)
}

/**
 * Renders an off-screen HTML string to a PDF (base64) using jsPDF + html2canvas.
 * The HTML can be built with the existing print-template helpers.
 */
export async function htmlToPdfBase64(html: string): Promise<string> {
  const holder = document.createElement('div');
  holder.style.position = 'fixed';
  holder.style.left = '-99999px';
  holder.style.top = '0';
  holder.style.width = '794px'; // ~ A4 width @ 96dpi
  holder.style.background = '#ffffff';
  holder.innerHTML = html;
  document.body.appendChild(holder);
  try {
    const canvas = await html2canvas(holder, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
    const imgData = canvas.toDataURL('image/jpeg', 0.92);
    const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgW = pageW;
    const imgH = (canvas.height * imgW) / canvas.width;
    let y = 0;
    if (imgH <= pageH) {
      pdf.addImage(imgData, 'JPEG', 0, 0, imgW, imgH);
    } else {
      // multi-page
      let remaining = imgH;
      while (remaining > 0) {
        pdf.addImage(imgData, 'JPEG', 0, y, imgW, imgH);
        remaining -= pageH;
        y -= pageH;
        if (remaining > 0) pdf.addPage();
      }
    }
    const dataUri = pdf.output('datauristring');
    return dataUri.split(',')[1] || dataUri;
  } finally {
    document.body.removeChild(holder);
  }
}

export async function sendForSignature(args: SendForSignatureArgs) {
  const { data, error } = await supabase.functions.invoke('boldsign-send', {
    body: {
      document_type: args.documentType,
      document_id: args.documentId,
      document_number: args.documentNumber,
      signer_name: args.signerName,
      signer_email: args.signerEmail,
      title: args.title,
      message: args.message,
      pdf_base64: args.pdfBase64,
    },
  });
  if (error) throw new Error(error.message || 'Failed to send for signature');
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as { success: boolean; boldsign_document_id: string; signature_request_id: string };
}

export async function refreshSignatureStatus(signatureRequestId: string) {
  const { data, error } = await supabase.functions.invoke('boldsign-status', {
    body: { signature_request_id: signatureRequestId },
  });
  if (error) throw new Error(error.message);
  return data as { status: string; signed_pdf_path?: string | null };
}

export async function downloadSignedPdf(path: string, filename = 'signed.pdf') {
  const { data, error } = await supabase.storage.from('signed-documents').download(path);
  if (error) throw new Error(error.message);
  const url = URL.createObjectURL(data);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  a.remove(); URL.revokeObjectURL(url);
}
