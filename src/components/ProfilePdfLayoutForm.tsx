"use client";

import { useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { updateMyPdfLayoutAction } from "@/app/actions";

type Orientation = "portrait" | "landscape";

export function ProfilePdfLayoutForm({
  initialOrientation,
  initialColumns,
  initialTocColumns,
}: {
  initialOrientation?: Orientation;
  initialColumns?: "1" | "2";
  initialTocColumns?: "1" | "2" | "3";
}) {
  const { t } = useTranslation();
  const [orientation, setOrientation] = useState<Orientation>(
    initialOrientation ?? "portrait"
  );
  const [columns, setColumns] = useState<"1" | "2">(initialColumns ?? "1");
  const [tocColumns, setTocColumns] = useState<"1" | "2" | "3">(
    initialTocColumns ?? "1"
  );
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle"
  );

  const handleSave = async () => {
    setStatus("saving");
    const result = await updateMyPdfLayoutAction({
      orientation: orientation,
      columns: columns,
      tocColumns: tocColumns,
    });
    if (result.ok) {
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2000);
    } else {
      setStatus("error");
    }
  };

  const pill = (active: boolean, className: string) =>
    `px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${active
      ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-500 dark:border-blue-400"
      : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 border-neutral-300 dark:border-neutral-700"}`;

  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold mb-1">{t("profile.pdfLayout")}</h2>
      <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">
        {t("profile.pdfLayoutDesc")}
      </p>

      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium mb-2">
            {t("profile.pdfOrientation")}
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setOrientation("portrait")}
              className={pill(orientation === "portrait", "")}
            >
              {t("profile.pdfPortrait")}
            </button>
            <button
              type="button"
              onClick={() => setOrientation("landscape")}
              className={pill(orientation === "landscape", "")}
            >
              {t("profile.pdfLandscape")}
            </button>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">
            {t("profile.pdfColumns")}
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setColumns("1")}
              className={pill(columns === "1", "")}
            >
              {t("profile.pdfCol1")}
            </button>
            <button
              type="button"
              onClick={() => setColumns("2")}
              className={pill(columns === "2", "")}
            >
              {t("profile.pdfCol2")}
            </button>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">
            {t("profile.pdfTocColumns")}
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setTocColumns("1")}
              className={pill(tocColumns === "1", "")}
            >
              {t("profile.pdfTocCol1")}
            </button>
            <button
              type="button"
              onClick={() => setTocColumns("2")}
              className={pill(tocColumns === "2", "")}
            >
              {t("profile.pdfTocCol2")}
            </button>
            <button
              type="button"
              onClick={() => setTocColumns("3")}
              className={pill(tocColumns === "3", "")}
            >
              {t("profile.pdfTocCol3")}
            </button>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={status === "saving"}
        className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-60"
      >
        {status === "saving" ? t("profile.pdfLayoutSaving") : t("profile.pdfLayoutSave")}
      </button>
      {status === "saved" && (
        <p className="mt-2 text-sm text-green-600 dark:text-green-400">
          {t("profile.pdfLayoutSaved")}
        </p>
      )}
      {status === "error" && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">
          {t("profile.pdfLayoutFailed")}
        </p>
      )}
    </section>
  );
}
