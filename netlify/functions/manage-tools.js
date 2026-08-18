// ============================================
// 民生國小 AI 教育工具中心
// 管理 API V2
//
// 功能：
// GET    → 取得 tools.json
// POST   → 新增工具
// PUT    → 修改工具
// DELETE → 刪除工具
//
// 安全：
// ADMIN_PASSWORD 與 GITHUB_TOKEN
// 都只存在 Netlify Environment Variables
// ============================================


const jsonHeaders = {
    "Content-Type": "application/json; charset=utf-8"
};


// ============================================
// 回傳 JSON
// ============================================

function response(data, status = 200) {

    return new Response(
        JSON.stringify(data),
        {
            status,
            headers: jsonHeaders
        }
    );

}


// ============================================
// 取得環境變數
// ============================================

function getConfig() {

    const token =
        Netlify.env.get("GITHUB_TOKEN");

    const password =
        Netlify.env.get("ADMIN_PASSWORD");

    const owner =
        "lym5410-sudo";

    const repo =
        "msps.ai";

    const path =
        "tools.json";


    return {
        token,
        password,
        owner,
        repo,
        path
    };

}


// ============================================
// GitHub API URL
// ============================================

function getGithubUrl(config) {

    return (
        `https://api.github.com/repos/` +
        `${config.owner}/` +
        `${config.repo}/` +
        `contents/${config.path}`
    );

}


// ============================================
// GitHub Request
// ============================================

async function githubRequest(
    config,
    method = "GET",
    body = null
) {

    const options = {

        method,

        headers: {

            "Authorization":
                `Bearer ${config.token}`,

            "Accept":
                "application/vnd.github+json",

            "X-GitHub-Api-Version":
                "2022-11-28",

            "Content-Type":
                "application/json"

        }

    };


    if (body) {

        options.body =
            JSON.stringify(body);

    }


    return fetch(
        getGithubUrl(config),
        options
    );

}


// ============================================
// 取得 tools.json
// ============================================

async function getToolsFile(config) {

    const response =
        await githubRequest(
            config,
            "GET"
        );


    if (!response.ok) {

        const error =
            await response.text();

        throw new Error(
            `GitHub 讀取失敗：${response.status} ${error}`
        );

    }


    const data =
        await response.json();


    // GitHub API 回傳 Base64
    const content =
        data.content
            .replace(/\n/g, "");


    const decoded =
        Uint8Array.from(
            atob(content),
            char => char.charCodeAt(0)
        );


    const text =
        new TextDecoder("utf-8")
            .decode(decoded);


    const tools =
        JSON.parse(text);


    return {

        tools,

        sha: data.sha

    };

}


// ============================================
// 驗證管理密碼
// ============================================

function checkPassword(
    request,
    config
) {

    const password =
        request.headers.get(
            "X-Admin-Password"
        );


    if (!password) {

        return false;

    }


    return (
        password ===
        config.password
    );

}


// ============================================
// 寫入 tools.json
// ============================================

async function saveToolsFile(
    config,
    tools,
    sha
) {

    const content =
        JSON.stringify(
            tools,
            null,
            4
        );


    // UTF-8 → Base64
    const bytes =
        new TextEncoder()
            .encode(content);


    let binary = "";

    bytes.forEach(
        byte => {
            binary +=
                String.fromCharCode(byte);
        }
    );


    const base64 =
        btoa(binary);


    const response =
        await githubRequest(
            config,
            "PUT",
            {

                message:
                    "更新 AI 教育工具中心工具資料",

                content:
                    base64,

                sha

            }
        );


    if (!response.ok) {

        const error =
            await response.text();

        throw new Error(
            `GitHub 寫入失敗：${response.status} ${error}`
        );

    }


    return response.json();

}


// ============================================
// 驗證工具資料
// ============================================

function validateTool(tool) {

    const requiredFields = [

        "name",
        "url",
        "category",
        "grade",
        "icon",
        "description"

    ];


    for (
        const field
        of requiredFields
    ) {

        if (
            !tool[field] ||
            typeof tool[field] !== "string"
        ) {

            return (
                `缺少必要欄位：${field}`
            );

        }

    }


    return null;

}


// ============================================
// API
// ============================================

export default async (request) => {

    try {

        const config =
            getConfig();


        // ------------------------------------
        // 檢查環境變數
        // ------------------------------------

        if (!config.token) {

            return response(
                {
                    success: false,
                    message:
                        "GITHUB_TOKEN 尚未設定"
                },
                500
            );

        }


        if (!config.password) {

            return response(
                {
                    success: false,
                    message:
                        "ADMIN_PASSWORD 尚未設定"
                },
                500
            );

        }


        // ====================================
        // GET
        // 讀取工具
        // ====================================

        if (
            request.method ===
            "GET"
        ) {

            const result =
                await getToolsFile(
                    config
                );


            return response({

                success: true,

                tools:
                    result.tools

            });

        }


        // ====================================
        // 其他操作需要管理密碼
        // ====================================

        if (
            !checkPassword(
                request,
                config
            )
        ) {

            return response(
                {
                    success: false,
                    message:
                        "管理者驗證失敗"
                },
                401
            );

        }


        // ====================================
        // POST
        // 新增工具
        // ====================================

        if (
            request.method ===
            "POST"
        ) {

            const tool =
                await request.json();


            const validation =
                validateTool(tool);


            if (validation) {

                return response(
                    {
                        success: false,
                        message:
                            validation
                    },
                    400
                );

            }


            const result =
                await getToolsFile(
                    config
                );


            const tools =
                result.tools;


            // 建立唯一 ID
            const newTool = {

                id:
                    Date.now().toString(),

                ...tool

            };


            tools.push(
                newTool
            );


            await saveToolsFile(
                config,
                tools,
                result.sha
            );


            return response({

                success: true,

                message:
                    "工具新增成功",

                tool:
                    newTool

            });

        }


        // ====================================
        // PUT
        // 修改工具
        // ====================================

        if (
            request.method ===
            "PUT"
        ) {

            const data =
                await request.json();


            if (!data.id) {

                return response(
                    {
                        success: false,
                        message:
                            "缺少工具 ID"
                    },
                    400
                );

            }


            const result =
                await getToolsFile(
                    config
                );


            const tools =
                result.tools;


            const index =
                tools.findIndex(
                    tool =>
                        String(tool.id) ===
                        String(data.id)
                );


            if (index === -1) {

                return response(
                    {
                        success: false,
                        message:
                            "找不到指定工具"
                    },
                    404
                );

            }


            const updatedTool = {

                ...tools[index],

                ...data

            };


            const validation =
                validateTool(
                    updatedTool
                );


            if (validation) {

                return response(
                    {
                        success: false,
                        message:
                            validation
                    },
                    400
                );

            }


            tools[index] =
                updatedTool;


            await saveToolsFile(
                config,
                tools,
                result.sha
            );


            return response({

                success: true,

                message:
                    "工具修改成功",

                tool:
                    updatedTool

            });

        }


        // ====================================
        // DELETE
        // 刪除工具
        // ====================================

        if (
            request.method ===
            "DELETE"
        ) {

            const data =
                await request.json();


            if (!data.id) {

                return response(
                    {
                        success: false,
                        message:
                            "缺少工具 ID"
                    },
                    400
                );

            }


            const result =
                await getToolsFile(
                    config
                );


            const tools =
                result.tools;


            const newTools =
                tools.filter(
                    tool =>
                        String(tool.id) !==
                        String(data.id)
                );


            if (
                newTools.length ===
                tools.length
            ) {

                return response(
                    {
                        success: false,
                        message:
                            "找不到指定工具"
                    },
                    404
                );

            }


            await saveToolsFile(
                config,
                newTools,
                result.sha
            );


            return response({

                success: true,

                message:
                    "工具刪除成功"

            });

        }


        // ====================================
        // 不支援的方法
        // ====================================

        return response(
            {
                success: false,
                message:
                    "不支援的操作"
            },
            405
        );


    }

    catch (error) {

        console.error(
            "manage-tools error:",
            error
        );


        return response(
            {
                success: false,
                message:
                    "伺服器發生錯誤",
                detail:
                    error.message
            },
            500
        );

    }

};
