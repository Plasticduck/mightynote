const { neon } = require('@neondatabase/serverless');

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    // Support both GET and POST
    if (event.httpMethod !== 'GET' && event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ success: false, error: 'Method not allowed' })
        };
    }

    try {
        const sql = neon(process.env.NETLIFY_DATABASE_URL);

        // CAR AUDIO data from spreadsheets - All consolidated
        const carAudioItems = [
            // PAC - First image items
            { brand: 'PAC', item: 'BKNDK716' },
            { brand: 'PAC', item: 'BKNDK724' },
            { brand: 'PAC', item: 'BKNDK742' },
            { brand: 'PAC', item: 'BKTOYK958' },
            { brand: 'PAC', item: 'TOYK961' },
            { brand: 'PAC', item: 'BKTOYK963' },
            { brand: 'PAC', item: 'BKTOYK964S' },
            { brand: 'PAC', item: 'BKTOYK966' },
            { brand: 'PAC', item: 'BKTOYK983S' },
            { brand: 'PAC', item: 'SBK927' },
            { brand: 'PAC', item: 'BKTOYK968' },
            { brand: 'PAC', item: 'BKGMK260' },
            { brand: 'PAC', item: 'BKGMK236' },
            { brand: 'PAC', item: 'BKFP305' },
            { brand: 'PAC', item: 'BKFMK505' },
            { brand: 'PAC', item: 'GMK325BM' },
            { brand: 'PAC', item: 'BKGMK334' },
            { brand: 'PAC', item: 'GMK381' },
            { brand: 'PAC', item: 'BKGMK912' },
            { brand: 'PAC', item: 'GMK420' },
            { brand: 'PAC', item: 'GMK421' },
            { brand: 'PAC', item: 'GMK422' },
            { brand: 'PAC', item: 'BKFMK504' },
            { brand: 'PAC', item: 'FMK526' },
            { brand: 'PAC', item: 'BKFMK534' },
            { brand: 'PAC', item: 'FMK538' },
            { brand: 'PAC', item: 'GMK317' },
            { brand: 'PAC', item: 'BKFMK549' },
            { brand: 'PAC', item: 'FMK550' },
            { brand: 'PAC', item: 'BKFMK554' },
            { brand: 'PAC', item: 'BKFMK564' },
            { brand: 'PAC', item: 'TTR992' },
            { brand: 'PAC', item: 'GMK262' },
            { brand: 'PAC', item: 'CDK640' },
            { brand: 'PAC', item: 'CDK641' },
            { brand: 'PAC', item: 'CDK642' },
            { brand: 'PAC', item: 'CDK644' },
            { brand: 'PAC', item: 'CDK648' },
            
            // PAC - Second image items
            { brand: 'PAC', item: 'BKCDK649' },
            { brand: 'PAC', item: 'BKCDK651' },
            { brand: 'PAC', item: 'BKCDK650' },
            { brand: 'PAC', item: 'CDK652' },
            { brand: 'PAC', item: 'CDK656' },
            { brand: 'PAC', item: 'GMK343' },
            
            // METRA
            { brand: 'METRA', item: '99-7603' },
            
            // STINGER - Second image
            { brand: 'STINGER', item: 'AMP: MT1000.1' },
            { brand: 'STINGER', item: 'SPKR WIRE: 12GA' },
            { brand: 'STINGER', item: 'SPKR WIRE: 8GA' },
            { brand: 'STINGER', item: 'SPKR WIRE: 4GA' },
            { brand: 'STINGER', item: 'SPKR WIRE: 0GA' },
            { brand: 'STINGER', item: 'SPKR WIRE: RCA' },
            
            // STINGER - Fourth image
            { brand: 'STINGER', item: 'WIRE KIT: OGA' },
            { brand: 'STINGER', item: 'WIRE KIT: 4GA' },
            { brand: 'STINGER', item: 'WIRE KIT: 8GA' },
            { brand: 'STINGER', item: 'INLINEFUSE: 200A' },
            { brand: 'STINGER', item: 'INLINEFUSE: 300A' },
            
            // EPICENTER
            { brand: 'EPICENTER', item: 'AMP: EPIC1500' },
            { brand: 'EPICENTER', item: 'AMP: EPIC2000' },
            
            // ROCKFORD FOSGATE - Second image
            { brand: 'ROCKFORD FOSGATE', item: 'AMP: R2-300x4' },
            { brand: 'ROCKFORD FOSGATE', item: 'AMP: R2-500x1' },
            { brand: 'ROCKFORD FOSGATE', item: 'AMP: R2-740x1' },
            { brand: 'ROCKFORD FOSGATE', item: 'AMP: R2-1200x1' },
            { brand: 'ROCKFORD FOSGATE', item: 'AMP: P1000x5' },
            { brand: 'ROCKFORD FOSGATE', item: 'SPKRS: P1692' },
            { brand: 'ROCKFORD FOSGATE', item: 'SPKRS: P1694' },
            { brand: 'ROCKFORD FOSGATE', item: 'SPKRS: T1650' },
            { brand: 'ROCKFORD FOSGATE', item: 'SPKRS: T1692' },
            { brand: 'ROCKFORD FOSGATE', item: 'SPKRS: T1462' },
            { brand: 'ROCKFORD FOSGATE', item: 'SPKRS: P1683' },
            { brand: 'ROCKFORD FOSGATE', item: 'SPKRS: P1650' },
            { brand: 'ROCKFORD FOSGATE', item: 'SPKRS: P1572' },
            { brand: 'ROCKFORD FOSGATE', item: 'SPKRS: P152' },
            { brand: 'ROCKFORD FOSGATE', item: 'SPKRS: P1462' },
            
            // ROCKFORD FOSGATE - Third image
            { brand: 'ROCKFORD FOSGATE', item: 'SPKRS: P142' },
            { brand: 'ROCKFORD FOSGATE', item: 'SPKRS: P132' },
            { brand: 'ROCKFORD FOSGATE', item: 'SPKRS: PIT-S' },
            
            // PIONEER
            { brand: 'PIONEER', item: 'STEREO: MVH-X390BT' },
            { brand: 'PIONEER', item: 'STEREO: MVH-S322BT' },
            { brand: 'PIONEER', item: 'STEREO: DMH-241EX' },
            { brand: 'PIONEER', item: 'STEREO: DMH-W2770' },
            
            // KENWOOD
            { brand: 'KENWOOD', item: 'STEREO: KDC-BT282U' },
            { brand: 'KENWOOD', item: 'STEREO: KMM-BT38' },
            { brand: 'KENWOOD', item: 'STEREO: DDX-376BT' },
            { brand: 'KENWOOD', item: 'STEREO: DDX-5707S' },
            
            // JENSEN
            { brand: 'JENSEN', item: 'STEREO: MPR211C' },
            { brand: 'JENSEN', item: 'STEREO: MPR-2121' },
            { brand: 'JENSEN', item: 'STEREO: CMR-272C' },
            { brand: 'JENSEN', item: 'STEREO: CAR-710W' },
            
            // PAC - Third image HARNESS items
            { brand: 'PAC', item: 'HARNESS: BHA2001R' },
            { brand: 'PAC', item: 'HARNESS: BHA2002' },
            { brand: 'PAC', item: 'HARNESS: BHA1692' },
            { brand: 'PAC', item: 'HARNESS: BHA2003' },
            { brand: 'PAC', item: 'HARNESS: BHA2102' },
            { brand: 'PAC', item: 'HARNESS: BHA1770' },
            { brand: 'PAC', item: 'HARNESS: BHA5600' },
            { brand: 'PAC', item: 'HARNESS: BHA5700' },
            { brand: 'PAC', item: 'HARNESS: FWH692' },
            { brand: 'PAC', item: 'HARNESS: BHA6522' },
            { brand: 'PAC', item: 'HARNESS: BHA7001' },
            { brand: 'PAC', item: 'HARNESS: BHA7005' },
            { brand: 'PAC', item: 'HARNESS: DWH664' },
            { brand: 'PAC', item: 'HARNESS: BHA7300' },
            { brand: 'PAC', item: 'HARNESS: BHA7301' },
            { brand: 'PAC', item: 'HARNESS: BHA7550' },
            { brand: 'PAC', item: 'HARNESS: NWH704' },
            { brand: 'PAC', item: 'HARNESS: BHA7712' },
            { brand: 'PAC', item: 'HARNESS: BHA9003' },
            { brand: 'PAC', item: 'HARNESS: BHA7303' },
            { brand: 'PAC', item: 'HARNESS: BHA1003' },
            { brand: 'PAC', item: 'HARNESS: BHA1004' },
            { brand: 'PAC', item: 'HARNESS: BHA1120' },
            { brand: 'PAC', item: 'HARNESS: BHA1398' },
            { brand: 'PAC', item: 'HARNESS: BHA16771' },
            { brand: 'PAC', item: 'HARNESS: BHA1720' },
            { brand: 'PAC', item: 'HARNESS: BHA1721' },
            { brand: 'PAC', item: 'HARNESS: BHA1722' },
            { brand: 'PAC', item: 'HARNESS: BHA1729' },
            { brand: 'PAC', item: 'HARNESS: BHA1743' },
            { brand: 'PAC', item: 'HARNESS: BHA1761' },
            { brand: 'PAC', item: 'HARNESS: BHA5511' },
            { brand: 'PAC', item: 'HARNESS: FWH598' },
            { brand: 'PAC', item: 'HARNESS: BHA1772' },
            { brand: 'PAC', item: 'HARNESS: BHA1780' },
            { brand: 'PAC', item: 'HARNESS: BHA1781' },
            { brand: 'PAC', item: 'HARNESS: BHA1782' },
            { brand: 'PAC', item: 'HARNESS: BHA1783' },
            
            // PAC - Fourth image HARNESS items
            { brand: 'PAC', item: 'HARNESS: VWH1000' },
            { brand: 'PAC', item: 'HARNESS: BHA1817' },
            { brand: 'PAC', item: 'HARNESS: BHA1818' },
            { brand: 'PAC', item: 'HARNESS: GWH344' },
            { brand: 'PAC', item: 'HARNESS: HWH1110' },
            { brand: 'PAC', item: 'HARNESS: BHA1763' },
            { brand: 'PAC', item: 'HARNESS: BAAY2M' },
            { brand: 'PAC', item: 'HARNESS: BAA3' },
            { brand: 'PAC', item: 'HARNESS: GM6' },
            { brand: 'PAC', item: 'HARNESS: BAA5' },
            { brand: 'PAC', item: 'HARNESS: BAA7' },
            { brand: 'PAC', item: 'HARNESS: BAA9' },
            { brand: 'PAC', item: 'HARNESS: BAA15' },
            { brand: 'PAC', item: 'HARNESS: BAA18' },
            { brand: 'PAC', item: 'HARNESS: BAAIN' },
            { brand: 'PAC', item: 'HARNESS: EU06' },
            { brand: 'PAC', item: 'HARNESS: BAA23' },
            { brand: 'PAC', item: 'HARNESS: BAA24' },
            { brand: 'PAC', item: 'HARNESS: BAA26' },
            { brand: 'PAC', item: 'HARNESS: BAA28' },
            { brand: 'PAC', item: 'HARNESS: BAA30' },
            { brand: 'PAC', item: 'HARNESS: BAA32' },
            { brand: 'PAC', item: 'HARNESS: BAA34' },
            { brand: 'PAC', item: 'HARNESS: N16' },
            { brand: 'PAC', item: 'HARNESS: BAA38' },
            { brand: 'PAC', item: 'HARNESS: BAA40' },
            { brand: 'PAC', item: 'HARNESS: BAA42' },
            { brand: 'PAC', item: 'HARNESS: LX8' },
            { brand: 'PAC', item: 'HARNESS: BAAMT100' },
            { brand: 'PAC', item: 'HARNESS: BAAMM' },
            { brand: 'PAC', item: 'HARNESS: BHA1002A' },
            
            // PAC - Fourth image other items
            { brand: 'PAC', item: 'LCCH11' },
            { brand: 'PAC', item: 'LCGM24' },
            { brand: 'PAC', item: 'LCGM29' },
            { brand: 'PAC', item: 'LCGM51' },
            
            // KICKER
            { brand: 'KICKER', item: 'OUTPUTCONVERTER' },
            
            // PAC - Fifth image items
            { brand: 'PAC', item: 'LCGM52' },
            { brand: 'PAC', item: 'CAMGM51' },
            { brand: 'PAC', item: 'APHCH42' },
            { brand: 'PAC', item: 'SW1-CP2' },
            { brand: 'PAC', item: 'CAMTY11' },
            { brand: 'PAC', item: 'CR2CHYNA' },
            { brand: 'PAC', item: 'AP4F021' },
            { brand: 'PAC', item: 'RP4GM32' },
            { brand: 'PAC', item: 'CAMTY12' },
            { brand: 'PAC', item: 'RP4F011' },
            { brand: 'PAC', item: 'RP5GM32' },
            { brand: 'PAC', item: 'ROEMN152' },
            { brand: 'PAC', item: 'G2RGM11' },
            { brand: 'PAC', item: 'GM1ARX' }
        ];

        const category = 'CAR AUDIO';

        // Remove duplicates by creating a Set of unique brand-item combinations
        const uniqueItems = [];
        const seen = new Set();
        
        carAudioItems.forEach(({ brand, item }) => {
            const key = `${brand}|${item}`;
            if (!seen.has(key)) {
                seen.add(key);
                uniqueItems.push({ brand, item });
            }
        });

        // Insert all unique items
        const insertPromises = uniqueItems.map(({ brand, item }) =>
            sql`
                INSERT INTO inventory_items (category, brand, item)
                VALUES (${category}, ${brand}, ${item})
                ON CONFLICT (category, brand, item) DO NOTHING
            `
        );

        await Promise.all(insertPromises);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
                success: true, 
                message: `Seeded ${uniqueItems.length} items for ${category}`,
                count: uniqueItems.length
            })
        };
    } catch (error) {
        console.error('Error seeding car audio data:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: error.message })
        };
    }
};
