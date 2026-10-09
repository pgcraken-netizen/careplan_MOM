"use client";

import { download } from "./common";

/** 画面のA4シートをそのまま画像化してA4のPDFにする（見た目が完全に一致する） */
export async function exportPdf(sheet: HTMLElement, fileName: string) {
  const [{ toPng }, { jsPDF }] = await Promise.all([import("html-to-image"), import("jspdf")]);
  await document.fonts?.ready;
  const png = await toPng(sheet, {
    pixelRatio: 3,
    backgroundColor: "#ffffff",
    style: { boxShadow: "none", margin: "0" },
    cacheBust: true,
  });
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
  pdf.addImage(png, "PNG", 0, 0, 210, 297, undefined, "FAST");
  pdf.setProperties({ title: fileName, creator: "アソシエ 担当者会議議事録" });
  download(pdf.output("blob"), `${fileName}.pdf`);
}
