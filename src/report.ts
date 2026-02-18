import * as fs from "node:fs";
import * as path from "node:path";
import type { ExtractedPageData } from "./crawl";


export function writeCSVReport(pageData: Record<string, ExtractedPageData | unknown>, filename: string = "report.csv"): void {
    if (!pageData || Object.keys(pageData).length === 0) {
        console.warn("No page data to write to CSV report.");
        return;
    }
    
    const headers: string[] = [
        "page_url",
        "h1",
        "first_paragraph",
        "outgoing_link_urls",
        "image_urls"];
    const rows: string[] = [headers.join(",")];


    const csvEscape = (str: string): string => {
        const field = str ?? "";
        const needsQuoting = /[",\n]/.test(field);
        const escaped = field.replace(/"/g, '""');
        return needsQuoting ? `"${escaped}"` : escaped;
    }

    const sortedKeys = Object.keys(pageData).sort();

    for (const key of sortedKeys) {
        const data = pageData[key] as ExtractedPageData;
        if (!data || typeof data !== "object") { continue; }

        const url = typeof data.url === "string" ? data.url : key;
        const h1 = typeof data.h1 === "string" ? data.h1 : " ";
        const firstParagraph = typeof data.firstParagraph === "string" ? data.firstParagraph : " ";
        const outgoingLinks = Array.isArray(data.outgoingLinks) ? data.outgoingLinks : [];
        const imageURLs = Array.isArray(data.imageURLs) ? data.imageURLs : [];

        const values = [url, h1, firstParagraph, outgoingLinks.join(";"), imageURLs.join(";")].map(csvEscape);
        rows.push(values.join(","));
    }

    const filePath = path.resolve(process.cwd(), filename);
    try {
        fs.writeFileSync(filePath, rows.join("\n"), "utf-8");
        console.log(`CSV report written to ${filePath}`);
    }
    catch (err) {
        console.error(`Failed to write CSV report: ${err}`);
    }


}