import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export async function exportDiagramAsPNG(filename = 'architecture-diagram') {
  const el = document.querySelector('.react-flow') as HTMLElement;
  if (!el) return;

  const minimap = el.querySelector('.react-flow__minimap') as HTMLElement | null;
  const controls = el.querySelector('.react-flow__controls') as HTMLElement | null;
  if (minimap) minimap.style.display = 'none';
  if (controls) controls.style.display = 'none';

  const canvas = await html2canvas(el, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#0f172a',
    logging: false,
  });

  if (minimap) minimap.style.display = '';
  if (controls) controls.style.display = '';

  const link = document.createElement('a');
  link.download = `${filename}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

export async function exportDiagramAsPDF(filename = 'architecture-diagram') {
  const el = document.querySelector('.react-flow') as HTMLElement;
  if (!el) return;

  const minimap = el.querySelector('.react-flow__minimap') as HTMLElement | null;
  const controls = el.querySelector('.react-flow__controls') as HTMLElement | null;
  if (minimap) minimap.style.display = 'none';
  if (controls) controls.style.display = 'none';

  const canvas = await html2canvas(el, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#0f172a',
    logging: false,
  });

  if (minimap) minimap.style.display = '';
  if (controls) controls.style.display = '';

  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF('l', 'mm', 'a4');
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

  let heightLeft = pdfHeight;
  let position = 0;
  const pageHeight = pdf.internal.pageSize.getHeight();

  pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
  heightLeft -= pageHeight;

  while (heightLeft > 0) {
    position = heightLeft - pdfHeight;
    pdf.addPage();
    pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
    heightLeft -= pageHeight;
  }

  pdf.save(`${filename}.pdf`);
}
