export default async (request) => {
    try {
        // ================================
        // 只允許 GET
        // ================================
        if (request.method !== "GET") {
            return new Response(
                JSON.stringify({
                    success: false,
                    message: "只允許 GET 請求"
                }),
                {
                    status: 405,
                    headers: {
                        "Content-Type": "application/json"
                    }
                }
            );
        }

        // ================================
        // 讀取環境變數
        // ================================
        const token = Netlify.env.get("GITHUB_TOKEN");

        if (!token) {
            return new Response(
                JSON.stringify({
                    success: false,
                    message: "找不到 GITHUB_TOKEN"
                }),
                {
                    status: 500,
                    headers: {
                        "Content-Type": "application/json"
                    }
                }
            );
        }

        // ================================
        // GitHub API
        // ================================
        const owner = "lym5410-sudo";

        const repo = "msps.ai";

        const path = "tools.json";

        const url =
            `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;

        // ================================
        // 呼叫 GitHub
        // ================================
        const response = await fetch(url, {
            headers: {
                "Authorization": `Bearer ${token}`,
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28"
            }
        });

        if (!response.ok) {
            const errorText = await response.text();

            return new Response(
                JSON.stringify({
                    success: false,
                    message: "GitHub API 錯誤",
                    status: response.status,
                    detail: errorText
                }),
                {
                    status: response.status,
                    headers: {
                        "Content-Type": "application/json"
                    }
                }
            );
        }

        const data = await response.json();

        // ================================
        // 回傳基本資訊
        // ================================
        return new Response(
            JSON.stringify({
                success: true,
                message: "成功連接 GitHub",
                file: path,
                sha: data.sha
            }),
            {
                status: 200,
                headers: {
                    "Content-Type": "application/json"
                }
            }
        );

    } catch (error) {

        console.error(error);

        return new Response(
            JSON.stringify({
                success: false,
                message: "Function 執行失敗",
                error: error.message
            }),
            {
                status: 500,
                headers: {
                    "Content-Type": "application/json"
                }
            }
        );
    }
};
