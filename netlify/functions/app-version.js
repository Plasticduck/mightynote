exports.handler = async (event, context) => {
    // Return the current app version
    // Update this number whenever you deploy a new version
    const CURRENT_VERSION = 30;
    
    return {
        statusCode: 200,
        headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate'
        },
        body: JSON.stringify({
            success: true,
            version: CURRENT_VERSION
        })
    };
};
