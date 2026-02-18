import { URL } from 'url';
import { JSDOM } from 'jsdom';
import pLimit, { LimitFunction } from "p-limit";
import { errorHandler } from '.';

export interface ExtractedPageData {
    url: string;
    h1: string;
    firstParagraph: string;
    outgoingLinks: Set<string>;
    imageURLs: Set<string>;
} 

class ConcurrentCrawler {
    private baseURL: URL;
    private pages: Record<string, ExtractedPageData>;
    private readonly limit: LimitFunction;
    private shouldStop: boolean;
    private allTasks: Set<Promise<void>>;
    private visited = new Set<string>();
    private abortController: AbortController = new AbortController();

    constructor(baseURL: URL, private readonly maxConcurrency: number = 10, private readonly maxPages: number = 100) {
        this.baseURL = baseURL;
        this.pages = {};
        this.limit = pLimit(maxConcurrency);
        this.shouldStop = false;
        this.allTasks = new Set<Promise<void>>();
    }

    private addPagesVisit(normalizedURL: string): boolean{
        if (this.shouldStop) { return false; }
        if (this.visited.has(normalizedURL)) { return false; }
        else if (Object.keys(this.pages).length === this.maxPages) {
            this.shouldStop = true;
            console.log("Reached maximum number of pages to crawl.")
            this.abortController.abort();
            return false;
        }
        this.visited.add(normalizedURL);
        return true;
    }

    private async getHTML(currentURL: string): Promise<string> {
        return await this.limit(async () => {

            try {
                const response: Response = await fetch(currentURL, {
                    method: "GET",
                    mode: "cors",
                    headers: {
                        "User-Agent": "BootCrawler/1.0"
                    },
                    signal: this.abortController.signal
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
        if (this.shouldStop) { return; }

        const current = new URL(currentURL);
        if (this.baseURL.hostname !== current.hostname) { return; }
        
        const normalizedURL = normalizeURL(currentURL);
        if (!this.addPagesVisit(normalizedURL)) { return; }

        console.log(`Crawling: ${currentURL}`);
        const [err, html] = await errorHandler(this.getHTML(currentURL));
        if (err) {
            console.error(`Error fetching ${currentURL}: ${err}`);
            return;
        }

        const pageData: ExtractedPageData = extractPageData(html, currentURL);
        //normalized URL to ensure uniqueness
        this.pages[normalizedURL] = pageData;

        const URLs = pageData.outgoingLinks;

        const crawl = [...URLs].map(
            (url) => {
                const task = this.crawlPage(url);
                this.allTasks.add(task);
                task.finally(() =>
                    this.allTasks.delete(task)    
                );
                return task;
            }
        )
        
        await Promise.all(crawl)
            .catch((err) => {
                console.error(`Error crawling ${currentURL}: ${err}`);
            })
    }

    public async crawl(): Promise<Record<string, ExtractedPageData>> {
        const base = this.crawlPage(this.baseURL.toString());
        // Initial root crawl task to ensure it is tracked and awaited before returning results
        try {
            await base
            this.allTasks.add(base);
        } finally {
            this.allTasks.delete(base);
        }
        await Promise.allSettled([...this.allTasks]);
        return this.pages;
    }
}

export async function crawlSiteAsync(baseURL: URL, maxConcurrency?: number, maxPages?: number): Promise<Record<string, ExtractedPageData>>{
    const crawler = new ConcurrentCrawler(baseURL, maxConcurrency, maxPages); 
    return await crawler.crawl();
}

function normalizeURL(urlString: string): string{
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

function getH1FromHTML(htmlBody: string): string{
    const dom = new JSDOM(htmlBody);
    const h1 = dom.window.document.querySelectorAll("h1");
    dom.window.close();
    return h1.length > 0 ? h1[0].textContent || "" : "";
}

function getFirstParagraphFromHTML(htmlBody: string): string{
    const dom = new JSDOM(htmlBody);
    const main = dom.window.document.querySelector("main");

    const p = main?main.querySelector("p") || dom.window.document.querySelector("p") : dom.window.document.querySelector("p");
    dom.window.close();

    return p?.textContent || "";
}

function getURLsFromHTML(htmlBody: string, baseURL: string): Set<string>{
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

function getImagesFromHTML(htmlBody: string, baseURL: string): Set<string>{
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

function extractPageData(htmlBody: string, pageURL: string): ExtractedPageData{
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



