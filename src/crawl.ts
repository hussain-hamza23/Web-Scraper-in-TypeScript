import { URL } from 'url';
import { JSDOM } from 'jsdom';
import pLimit, { LimitFunction } from "p-limit";

export interface ExtractedPageData {
    url: string;
    h1: string;
    firstParagraph: string;
    outgoingLinks: Set<string>;
    imageURLs: Set<string>;
} 

class ConcurrentCrawler {
    private baseURL: URL;
    private pages: Record<string, number>;
    private limit: LimitFunction;
    private readonly maxConcurrency: number = 10;

    constructor(baseURL: URL) {
        this.baseURL = baseURL;
        this.pages = {};
        this.limit = pLimit(this.maxConcurrency);
    }

    private addPagesVisit(normalizedURL: string): boolean{
        this.pages[normalizedURL] = (this.pages[normalizedURL] ?? 0) + 1;
        return this.pages[normalizedURL] <= 1;
    }

    private async getHTML(currentURL: string): Promise<string> {
        return await this.limit(async () => {

            try {
                const response: Response = await fetch(currentURL, {
                    method: "GET",
                    mode: "cors",
                    headers: {
                        "User-Agent": "BootCrawler/1.0"
                    }
                });
                if (!response.ok) {
                    console.log(`Failed to fetch ${currentURL}: ${response.status} ${response.statusText}`);
                    return "Failed";
                }
                if (!response.headers.get("content-type")?.includes("text/html")) {
                    console.log(`Non-HTML content at ${currentURL}: ${response.headers.get("content-type")}`);
                    return "Failed";
                }
                return response.text();
            }
            catch (err) {
                console.log(`Error fetching ${currentURL}: ${err}`);
                return "Failed";
            }
        });
    }

    private async crawlPage(currentURL: string): Promise<void> {
        const current = new URL(currentURL);
        if (this.baseURL.hostname !== current.hostname) { return ; }

        const normalized_current = normalizeURL(currentURL);
        if (!this.addPagesVisit(normalized_current)) { return; }

        console.log(`Crawling: ${currentURL}`);
        let html: string;
        try {
            html = await this.getHTML(currentURL);
        } catch (error) {
            console.error(`Error fetching ${currentURL}: ${error}`);
            return;
        }

        const URLs: Set<string> = getURLsFromHTML(html, currentURL);

        const crawl = [...URLs].map(
            (url) => this.crawlPage(url)
        )
        
        await Promise.all(crawl);
    }

    public async crawl(): Promise<Record<string, number>> {
        await this.crawlPage(this.baseURL.toString());
        return this.pages;
    }
}

export async function crawlSiteAsync(baseURL: URL): Promise<Record<string, number>>{
    const crawler = new ConcurrentCrawler(baseURL); 
    return await crawler.crawl();
}

export function normalizeURL(urlString: string): string{
    /*if (!URL.canParse(urlString)) {
        console.error(`Invalid URL: ${urlString}`);
        return "";
    }
    const url: URL = new URL(urlString);*/
    let url: URL;
    try {
        url = new URL(urlString);
    }
    catch (err) {
        console.error(`Invalid URL: ${urlString}`);
        return "";
    }
    
    if (!url.hostname || !url.pathname) {
        console.error(`Invalid URL: ${urlString}`);
        return "";
    }
    const hostName = url.hostname;
    const pathName = url.pathname.replace(/\/$/, ""); // Remove trailing slash
    const normalizedPath = `${hostName}${pathName}`;
    return normalizedPath.toLowerCase()
}

export function getH1FromHTML(htmlBody: string): string{
    const dom = new JSDOM(htmlBody);
    const h1 = dom.window.document.querySelectorAll("h1");
    dom.window.close();
    return h1.length > 0 ? h1[0].textContent || "" : "";
}

export function getFirstParagraphFromHTML(htmlBody: string): string{
    const dom = new JSDOM(htmlBody);
    const main = dom.window.document.querySelector("main");

    const p = main?main.querySelector("p") || dom.window.document.querySelector("p") : dom.window.document.querySelector("p");
    dom.window.close();

    return p?.textContent || "";
}

export function getURLsFromHTML(htmlBody: string, baseURL: string): Set<string>{
    const urls: Set<string> = new Set();
    let dom: JSDOM | null = null;
    try {
        dom = new JSDOM(htmlBody);
        const aTags = dom.window.document.querySelectorAll("a");
        aTags.forEach((aTag) => {
            const href = aTag.getAttribute("href");
            //check if href is null
            if (!href) {
                return;
            }
            try {
                const url = new URL(href, baseURL);
                urls.add(url.toString());
            } catch (err) {
                console.error(`Invalid URL: ${href}`);
            }
        });
        dom.window.close();
    }
    catch (err) {
        console.error(`Error parsing HTML: ${err}`);
    } finally { if (dom) {
            dom.window.close();
        }
    }
    return urls;
}

export function getImagesFromHTML(htmlBody: string, baseURL: string): Set<string>{
    const urls: Set<string> = new Set();
    let dom: JSDOM | null = null;
    try {
        dom = new JSDOM(htmlBody);
        const imgTags = dom.window.document.querySelectorAll("img");
        imgTags.forEach((img) => {
            const src = img.getAttribute("src");
            if (!src) {
                return;
            }
            try {
                const url = new URL(src, baseURL);
                urls.add(url.toString());
            } catch (err) {
                console.error(`Invalid URL: ${src}`);
            } 
        });
    }
    catch (err) {
        console.error(`Error parsing HTML: ${err}`);
    } finally {
        if (dom) {
            dom.window.close();
        }
    }
    return urls;
}

export function extractPageData(htmlBody: string, pageURL: string): ExtractedPageData{
    const h1 = getH1FromHTML(htmlBody);
    const firstParagraph = getFirstParagraphFromHTML(htmlBody);
    const outgoingLinks = getURLsFromHTML(htmlBody, pageURL);
    const imageURLs = getImagesFromHTML(htmlBody, pageURL);

    return {
        url: pageURL,
        h1: h1,
        firstParagraph: firstParagraph,
        outgoingLinks: outgoingLinks,
        imageURLs: imageURLs
    } as const;
}



