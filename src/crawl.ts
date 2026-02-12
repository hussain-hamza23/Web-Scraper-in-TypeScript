import { URL } from 'url';
import { JSDOM } from 'jsdom';

export interface ExtractedPageData {
    url: string;
    h1: string;
    firstParagraph: string;
    outgoingLinks: Set<string>;
    imageURLs: Set<string>;
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

