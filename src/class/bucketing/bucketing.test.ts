import mockAxios from 'jest-mock-axios';
import { FlagshipVisitorContext } from '../flagshipVisitor/flagshipVisitor.d';
import { BucketingApiResponse } from './bucketing.d';
import { FlagshipSdkConfig, IFlagshipVisitor, IFlagshipBucketing, IFlagship } from '../../index.d';

import flagshipSdk from '../../index';
import demoData from '../../../test/mock/demoData';
import testConfig from '../../config/test';
import { internalConfig } from '../../config/default';
import Bucketing from './bucketing';

let sdk: IFlagship;
let visitorInstance: IFlagshipVisitor;
let bucketInstance: IFlagshipBucketing;
let responseObject: object;
let spyWarnLogs;
let spyErrorLogs;
let spyFatalLogs;
let spyInfoLogs;
let spyDebugLogs;
let bucketSpy;
let spyThen;
let spyCatch;

let bucketingApiMockResponse: BucketingApiResponse;
const bucketingApiMockOterResponse: { status: number; headers: { 'Last-Modified': string } } = {
    status: 200,
    headers: { 'Last-Modified': 'Wed, 18 Mar 2020 23:29:16 GMT' }
};

const bucketingConfig: FlagshipSdkConfig = {
    ...testConfig,
    fetchNow: true,
    decisionMode: 'Bucketing'
};

const initSpyLogs = (bInstance) => {
    spyWarnLogs = jest.spyOn(bInstance.log, 'warn');
    spyErrorLogs = jest.spyOn(bInstance.log, 'error');
    spyFatalLogs = jest.spyOn(bInstance.log, 'fatal');
    spyInfoLogs = jest.spyOn(bInstance.log, 'info');
    spyDebugLogs = jest.spyOn(bInstance.log, 'debug');
};

const expectedRequestHeaderFirstCall = { headers: { 'If-Modified-Since': '' } };

describe('Bucketing used from visitor instance', () => {
    beforeEach(() => {
        //
    });
    afterEach(() => {
        sdk = null;
        bucketingApiMockResponse = null;
        visitorInstance = null;
        bucketInstance = null;
        mockAxios.reset();
    });
    it('should trigger bucketing behavior when creating new visitor with config having "bucketing" in decision mode + fetchNow=true', (done) => {
        bucketingApiMockResponse = demoData.bucketing.classical as BucketingApiResponse;
        sdk = flagshipSdk.initSdk(demoData.envId[0], bucketingConfig);
        visitorInstance = sdk.newVisitor(demoData.visitor.id[0], demoData.visitor.cleanContext);
        expect(visitorInstance.bucket instanceof Bucketing).toEqual(true);
        mockAxios.mockResponse({ data: bucketingApiMockResponse, ...bucketingApiMockOterResponse });
        expect(mockAxios.get).toHaveBeenNthCalledWith(
            1,
            internalConfig.bucketingEndpoint.replace('@ENV_ID@', visitorInstance.envId),
            expectedRequestHeaderFirstCall
        );
        visitorInstance.on('ready', () => {
            try {
                expect(visitorInstance.fetchedModifications[0].id === demoData.bucketing.classical.campaigns[0].id).toEqual(true);
                expect(visitorInstance.fetchedModifications[1].id === demoData.bucketing.classical.campaigns[1].id).toEqual(true);
                done();
            } catch (error) {
                done.fail(error);
            }
        });
    });

    it('should NOT trigger bucketing behavior when creating new visitor with config having "bucketing" in decision mode + fetchNow=false', (done) => {
        bucketingApiMockResponse = demoData.bucketing.classical as BucketingApiResponse;
        sdk = flagshipSdk.initSdk(demoData.envId[0], { ...bucketingConfig, fetchNow: false });
        visitorInstance = sdk.newVisitor(demoData.visitor.id[0], demoData.visitor.cleanContext);
        expect(visitorInstance.bucket).toEqual(null);
        expect(mockAxios.get).toHaveBeenCalledTimes(0);
        visitorInstance.on('ready', () => {
            try {
                expect(visitorInstance.fetchedModifications).toEqual(null);
                done();
            } catch (error) {
                done.fail(error);
            }
        });
    });
});

describe('Bucketing - murmur algorithm', () => {
    beforeEach(() => {
        spyCatch = jest.fn();
        spyThen = jest.fn();
    });
    afterEach(() => {
        sdk = null;
        bucketingApiMockResponse = null;
        visitorInstance = null;
        bucketInstance = null;

        mockAxios.reset();
    });
    it('should works with "classical" scenario', (done) => {
        bucketInstance = new Bucketing(demoData.envId[0], bucketingConfig, demoData.visitor.id[0], demoData.visitor.cleanContext);
        initSpyLogs(bucketInstance);
        bucketSpy = jest.spyOn(bucketInstance, 'computeMurmurAlgorithm');
        const result = bucketInstance.computeMurmurAlgorithm(demoData.bucketing.functions.murmur.defaultArgs); // private function

        expect(result).toEqual({
            allocation: 50,
            id: 'bptggipaqi903f3haq2g',
            modifications: { type: 'JSON', value: { testCache: 'value' } }
        });
        expect(spyDebugLogs).toHaveBeenNthCalledWith(1, 'computeMurmurAlgorithm - murmur returned value="79"');
        expect(spyErrorLogs).toHaveBeenCalledTimes(0);
        expect(spyFatalLogs).toHaveBeenCalledTimes(0);
        expect(spyInfoLogs).toHaveBeenCalledTimes(0);
        expect(spyWarnLogs).toHaveBeenCalledTimes(0);
        done();
    });
    it('should be SDK ISO (visitorId="toto")', (done) => {
        bucketInstance = new Bucketing(demoData.envId[0], bucketingConfig, demoData.visitor.id[1], demoData.visitor.cleanContext);
        initSpyLogs(bucketInstance);
        bucketSpy = jest.spyOn(bucketInstance, 'computeMurmurAlgorithm');
        const result = bucketInstance.computeMurmurAlgorithm(demoData.bucketing.functions.murmur.defaultArgs); // private function

        expect(result).toEqual({
            allocation: 50,
            id: 'bptggipaqi903f3haq2g',
            modifications: { type: 'JSON', value: { testCache: 'value' } }
        });
        expect(spyDebugLogs).toHaveBeenNthCalledWith(1, 'computeMurmurAlgorithm - murmur returned value="21"');
        done();
    });
    it('should return an error if variation traffic not correct', (done) => {
        bucketInstance = new Bucketing(demoData.envId[0], bucketingConfig, demoData.visitor.id[1], demoData.visitor.cleanContext);
        initSpyLogs(bucketInstance);
        bucketSpy = jest.spyOn(bucketInstance, 'computeMurmurAlgorithm');
        const result = bucketInstance.computeMurmurAlgorithm(demoData.bucketing.functions.murmur.badTraffic); // private function

        expect(result).toEqual(null);
        expect(spyFatalLogs).toHaveBeenNthCalledWith(
            1,
            'computeMurmurAlgorithm - the variation traffic is equal to "80" instead of being equal to "100"'
        );
        done();
    });
});

describe('Bucketing - getEligibleCampaigns', () => {
    const getCorrespondingOperatorBucketingContext = (
        operator: string,
        type: string,
        bucketingContext: FlagshipVisitorContext
    ): FlagshipVisitorContext => ({
        ...Object.keys(bucketingContext).reduce(
            (reducer, key) => (key.includes(operator) && key.includes(type) ? { ...reducer, [key]: bucketingContext[key] } : reducer),
            {}
        )
    });
    const getCorrespondingOperatorApiMockResponse = (operator: string, type: string): BucketingApiResponse => {
        const campaign = (demoData.bucketing[`${operator}Operator`] as BucketingApiResponse).campaigns[0];
        const cloneCampaign = JSON.parse(JSON.stringify(campaign));
        cloneCampaign.variationGroups[0].targeting.targetingGroups[0].targetings = campaign.variationGroups[0].targeting.targetingGroups[0].targetings.filter(
            (t) => {
                //
                return t.key.includes(type);
            }
        );
        return {
            ...(demoData.bucketing[`${operator}Operator`] as BucketingApiResponse),
            campaigns: [cloneCampaign]
        };
    };
    const assertOperatorBehavior = (operator: string, type: string, shouldReportIssueBetweenValueTypeAndOperator: boolean): void => {
        const mapping = {
            equals: 'EQUALS',
            notEquals: 'NOT_EQUALS',
            lowerThan: 'LOWER_THAN',
            lowerThanOrEquals: 'LOWER_THAN_OR_EQUALS',
            greaterThan: 'GREATER_THAN',
            greaterThanOrEquals: 'GREATER_THAN_OR_EQUALS',
            startsWith: 'STARTS_WITH',
            endsWith: 'ENDS_WITH',
            contains: 'CONTAINS',
            notContains: 'NOT_CONTAINS'
        };
        it(`should compute correctly operator "${operator}" and type "${type}"`, (done) => {
            const bucketingContext = getCorrespondingOperatorBucketingContext(
                operator,
                type,
                demoData.visitor.contextBucketingOperatorTestSuccess
            );
            bucketingApiMockResponse = getCorrespondingOperatorApiMockResponse(operator, type);
            bucketInstance = new Bucketing(demoData.envId[0], bucketingConfig, demoData.visitor.id[0], bucketingContext);
            initSpyLogs(bucketInstance);
            const result = bucketInstance.getEligibleCampaigns(bucketingApiMockResponse);

            if (shouldReportIssueBetweenValueTypeAndOperator) {
                expect(result).toEqual([]);
                expect(spyDebugLogs).toHaveBeenNthCalledWith(1, 'Bucketing - campaign (id="bptggipaqi903f3haq0g") NOT MATCHING visitor');
                expect(spyErrorLogs).toHaveBeenCalledTimes(0);
                expect(spyFatalLogs).toHaveBeenCalledTimes(0);
                expect(spyInfoLogs).toHaveBeenCalledTimes(0);
                expect(spyWarnLogs).toHaveBeenNthCalledWith(
                    1,
                    `getEligibleCampaigns - operator "${mapping[operator]}" is not supported for type "${(type === 'Bool'
                        ? 'boolean'
                        : type
                    ).toLowerCase()}". Assertion aborted.`
                );
                expect(spyWarnLogs).toHaveBeenNthCalledWith(
                    2,
                    `getEligibleCampaigns - operator "${mapping[operator]}" is not supported for type "${(type === 'Bool'
                        ? 'boolean'
                        : type
                    ).toLowerCase()}". Assertion aborted.`
                );
            } else {
                expect(Array.isArray(result) && result.length === 1).toEqual(true);
                expect(result[0].id === bucketingApiMockResponse.campaigns[0].id).toEqual(true);

                expect(spyDebugLogs).toHaveBeenCalledTimes(2);
                expect(spyErrorLogs).toHaveBeenCalledTimes(0);
                expect(spyFatalLogs).toHaveBeenCalledTimes(0);
                expect(spyInfoLogs).toHaveBeenCalledTimes(0);
                expect(spyWarnLogs).toHaveBeenCalledTimes(0);
            }

            done();
        });
    };
    beforeEach(() => {
        spyCatch = jest.fn();
        spyThen = jest.fn();
    });
    afterEach(() => {
        sdk = null;
        bucketingApiMockResponse = null;
        visitorInstance = null;
        bucketInstance = null;

        mockAxios.reset();
    });

    const getBundleOfType = (t): { type: string; operator: string }[] =>
        [
            'equals',
            'notEquals',
            'lowerThan',
            'lowerThanOrEquals',
            'greaterThan',
            'greaterThanOrEquals',
            'startsWith',
            'endsWith',
            'contains',
            'notContains'
        ].map((o) => ({
            type: t,
            operator: o
        }));

    [...getBundleOfType('Bool'), ...getBundleOfType('String'), ...getBundleOfType('Number')].forEach((bt) => {
        switch (bt.operator) {
            case 'lowerThan': // ONLY BOOL
            case 'lowerThanOrEquals':
            case 'greaterThan':
            case 'greaterThanOrEquals':
                assertOperatorBehavior(bt.operator, bt.type, bt.type === 'Bool');
                break;

            case 'startsWith': // BOTH BOOL AND STRING
            case 'endsWith':
            case 'contains':
            case 'notContains':
                assertOperatorBehavior(bt.operator, bt.type, bt.type === 'Bool' || bt.type === 'Number');
                break;

            default:
                assertOperatorBehavior(bt.operator, bt.type, false);
        }
    });

    it('should expect correct behavior for "classic" data received', (done) => {
        bucketingApiMockResponse = demoData.bucketing.classical as BucketingApiResponse;
        bucketInstance = new Bucketing(demoData.envId[0], bucketingConfig, demoData.visitor.id[0], demoData.visitor.cleanContext);
        initSpyLogs(bucketInstance);
        const result = bucketInstance.getEligibleCampaigns(bucketingApiMockResponse);

        expect(result).toEqual([
            {
                id: 'bptggipaqi903f3haq0g',
                variationGroupId: 'bptggipaqi903f3haq1g',
                variation: {
                    id: 'bptggipaqi903f3haq2g',
                    modifications: {
                        type: 'JSON',
                        value: {
                            testCache: 'value'
                        }
                    }
                }
            },
            {
                id: 'bq4sf09oet0006cfihd0',
                variationGroupId: 'bq4sf09oet0006cfihe0',
                variation: {
                    id: 'bq4sf09oet0006cfihf0',
                    modifications: {
                        type: 'JSON',
                        value: {
                            'btn-color': 'green',
                            'btn-text': 'Buy now with discount !',
                            'txt-color': '#A3A3A3'
                        }
                    }
                }
            }
        ]);

        expect(spyDebugLogs).toHaveBeenCalledTimes(4);
        expect(spyErrorLogs).toHaveBeenCalledTimes(0);
        expect(spyFatalLogs).toHaveBeenCalledTimes(0);
        expect(spyInfoLogs).toHaveBeenCalledTimes(0);
        expect(spyWarnLogs).toHaveBeenCalledTimes(0);

        done();
    });

    it('should expect correct behavior for "multiple variation groups" data received', (done) => {
        bucketingApiMockResponse = demoData.bucketing.oneCampaignOneVgMultipleTgg as BucketingApiResponse;
        bucketInstance = new Bucketing(demoData.envId[0], bucketingConfig, demoData.visitor.id[0], { foo1: 'yes1' });
        const bucketInstance2 = new Bucketing(demoData.envId[0], bucketingConfig, demoData.visitor.id[0], { foo1: 'NOPE', foo2: 'yes2' });
        const bucketInstance3 = new Bucketing(demoData.envId[0], bucketingConfig, demoData.visitor.id[0], { foo3: 'yes3' });
        initSpyLogs(bucketInstance);
        let result = bucketInstance.getEligibleCampaigns(bucketingApiMockResponse);
        expect(Array.isArray(result) && result.length === 1).toEqual(true);
        result = bucketInstance2.getEligibleCampaigns(bucketingApiMockResponse);
        expect(Array.isArray(result) && result.length === 1).toEqual(true);
        result = bucketInstance3.getEligibleCampaigns(bucketingApiMockResponse);
        expect(Array.isArray(result) && result.length === 1).toEqual(true);

        expect(spyDebugLogs).toHaveBeenCalledTimes(4);
        expect(spyErrorLogs).toHaveBeenCalledTimes(0);
        expect(spyFatalLogs).toHaveBeenCalledTimes(0);
        expect(spyInfoLogs).toHaveBeenCalledTimes(0);
        expect(spyWarnLogs).toHaveBeenCalledTimes(0);

        done();
    });

    it('should expect correct behavior for "multiple campaigns" data received', (done) => {
        bucketingApiMockResponse = demoData.bucketing.multipleCampaigns as BucketingApiResponse;
        bucketInstance = new Bucketing(demoData.envId[0], bucketingConfig, demoData.visitor.id[0], { foo1: 'yes1' });
        const bucketInstance2 = new Bucketing(demoData.envId[0], bucketingConfig, demoData.visitor.id[0], { foo1: 'yes1', isVip: true });
        initSpyLogs(bucketInstance);
        let result = bucketInstance.getEligibleCampaigns(bucketingApiMockResponse);
        expect(Array.isArray(result) && result.length === 1).toEqual(true);
        result = bucketInstance2.getEligibleCampaigns(bucketingApiMockResponse);
        expect(Array.isArray(result) && result.length === 2).toEqual(true);

        expect(spyDebugLogs).toHaveBeenCalledTimes(6);
        expect(spyErrorLogs).toHaveBeenCalledTimes(0);
        expect(spyFatalLogs).toHaveBeenCalledTimes(0);
        expect(spyInfoLogs).toHaveBeenCalledTimes(0);
        expect(spyWarnLogs).toHaveBeenCalledTimes(0);

        done();
    });

    it('should expect correct behavior for "bad type between visitor context and" data received', (done) => {
        bucketingApiMockResponse = demoData.bucketing.badTypeBetweenTargetingAndVisitorContextKey as BucketingApiResponse;
        bucketInstance = new Bucketing(demoData.envId[0], bucketingConfig, demoData.visitor.id[0], {
            lowerThanBadType: 123,
            lowerThanBadTypeArray: 0,
            lowerThanBadTypeJson: 2
        });
        initSpyLogs(bucketInstance);
        const result = bucketInstance.getEligibleCampaigns(bucketingApiMockResponse);
        expect(result).toEqual([]);

        expect(spyDebugLogs).toHaveBeenNthCalledWith(1, 'Bucketing - campaign (id="bptggipaqi903f3haq0g") NOT MATCHING visitor');
        expect(spyErrorLogs).toHaveBeenNthCalledWith(
            1,
            'getEligibleCampaigns - The bucketing API returned a value which have not the same type ("number") as the visitor context key="lowerThanBadType"'
        );
        expect(spyErrorLogs).toHaveBeenNthCalledWith(
            2,
            'getEligibleCampaigns - The bucketing API returned a json object which is not supported by the SDK.'
        );

        expect(spyErrorLogs).toHaveBeenNthCalledWith(
            3,
            'getEligibleCampaigns - The bucketing API returned an array where some elements do not have same type ("number") as the visitor context key="lowerThanBadTypeArray"'
        );
        expect(spyFatalLogs).toHaveBeenCalledTimes(0);
        expect(spyInfoLogs).toHaveBeenCalledTimes(0);
        expect(spyWarnLogs).toHaveBeenCalledTimes(0);

        done();
    });
    it('should expect correct behavior for "fs_all_users" data received', (done) => {
        bucketingApiMockResponse = demoData.bucketing.fs_all_users as BucketingApiResponse;
        bucketInstance = new Bucketing(demoData.envId[0], bucketingConfig, demoData.visitor.id[0], {});
        initSpyLogs(bucketInstance);
        const result = bucketInstance.getEligibleCampaigns(bucketingApiMockResponse);
        expect(Array.isArray(result) && result.length === 1).toEqual(true);

        expect(spyDebugLogs).toHaveBeenCalledTimes(2);
        expect(spyErrorLogs).toHaveBeenCalledTimes(0);
        expect(spyFatalLogs).toHaveBeenCalledTimes(0);
        expect(spyInfoLogs).toHaveBeenCalledTimes(0);
        expect(spyWarnLogs).toHaveBeenCalledTimes(0);

        done();
    });

    it('should expect correct behavior for "fs_users" data received', (done) => {
        bucketingApiMockResponse = demoData.bucketing.fs_users as BucketingApiResponse;
        bucketInstance = new Bucketing(demoData.envId[0], bucketingConfig, demoData.visitor.id[0], {});
        initSpyLogs(bucketInstance);
        const result = bucketInstance.getEligibleCampaigns(bucketingApiMockResponse);
        expect(Array.isArray(result) && result.length === 1).toEqual(true);

        expect(spyDebugLogs).toHaveBeenCalledTimes(2);
        expect(spyErrorLogs).toHaveBeenCalledTimes(0);
        expect(spyFatalLogs).toHaveBeenCalledTimes(0);
        expect(spyInfoLogs).toHaveBeenCalledTimes(0);
        expect(spyWarnLogs).toHaveBeenCalledTimes(0);

        done();
    });

    it('should expect correct behavior for "bad murmur allocation" data received', (done) => {
        bucketingApiMockResponse = demoData.bucketing.oneCampaignWithBadTraffic as BucketingApiResponse;
        bucketInstance = new Bucketing(demoData.envId[0], bucketingConfig, demoData.visitor.id[0], {});
        initSpyLogs(bucketInstance);
        const result = bucketInstance.getEligibleCampaigns(bucketingApiMockResponse);
        expect(result).toEqual([]);

        expect(spyDebugLogs).toHaveBeenNthCalledWith(1, 'Bucketing - campaign (id="bptggipaqi903f3haq0g") is matching visitor context');
        expect(spyDebugLogs).toHaveBeenNthCalledWith(2, 'computeMurmurAlgorithm - murmur returned value="79"');
        expect(spyErrorLogs).toHaveBeenCalledTimes(0);
        expect(spyFatalLogs).toHaveBeenNthCalledWith(
            1,
            'computeMurmurAlgorithm - the variation traffic is equal to "110" instead of being equal to "100"'
        );
        expect(spyFatalLogs).toHaveBeenNthCalledWith(
            2,
            'computeMurmurAlgorithm - Unable to find the corresponding variation (campaignId="bptggipaqi903f3haq0g") using murmur for visitor (id="test-perf")'
        );
        expect(spyInfoLogs).toHaveBeenCalledTimes(0);
        expect(spyWarnLogs).toHaveBeenCalledTimes(0);

        done();
    });

    it('should expect correct behavior for "unknown operator" data received', (done) => {
        bucketingApiMockResponse = demoData.bucketing.badOperator as BucketingApiResponse;
        bucketInstance = new Bucketing(demoData.envId[0], bucketingConfig, demoData.visitor.id[0], { isVip: false });
        initSpyLogs(bucketInstance);
        const result = bucketInstance.getEligibleCampaigns(bucketingApiMockResponse);
        expect(result).toEqual([]);

        expect(spyDebugLogs).toHaveBeenNthCalledWith(1, 'Bucketing - campaign (id="bptggipaqi903f3haq0g") NOT MATCHING visitor');
        expect(spyErrorLogs).toHaveBeenNthCalledWith(
            1,
            'getEligibleCampaigns - unknown operator "I_DONT_EXIST" found in bucketing api answer. Assertion aborted.'
        );
        expect(spyFatalLogs).toHaveBeenCalledTimes(0);
        expect(spyInfoLogs).toHaveBeenCalledTimes(0);
        expect(spyWarnLogs).toHaveBeenCalledTimes(0);

        done();
    });
});

describe('Bucketing - launch', () => {
    beforeEach(() => {
        spyCatch = jest.fn();
        spyThen = jest.fn();
    });
    afterEach(() => {
        sdk = null;
        bucketingApiMockResponse = null;
        visitorInstance = null;
        bucketInstance = null;

        mockAxios.reset();
    });
    it('should works with "classical" bucket api response', (done) => {
        bucketingApiMockResponse = demoData.bucketing.classical as BucketingApiResponse;
        bucketInstance = new Bucketing(demoData.envId[0], bucketingConfig, demoData.visitor.id[0], demoData.visitor.cleanContext);
        initSpyLogs(bucketInstance);
        bucketInstance.launch().then(spyThen).catch(spyCatch);
        mockAxios.mockResponse({ data: bucketingApiMockResponse, ...bucketingApiMockOterResponse });
        expect(mockAxios.get).toHaveBeenNthCalledWith(
            1,
            internalConfig.bucketingEndpoint.replace('@ENV_ID@', bucketInstance.envId),
            expectedRequestHeaderFirstCall
        );
        expect(spyThen).toHaveBeenCalledWith(bucketingApiMockResponse);
        expect(spyCatch).not.toHaveBeenCalled();

        expect(spyDebugLogs).toHaveBeenNthCalledWith(1, 'Bucketing - campaign (id="bptggipaqi903f3haq0g") is matching visitor context');
        expect(spyDebugLogs).toHaveBeenNthCalledWith(3, 'Bucketing - campaign (id="bq4sf09oet0006cfihd0") is matching visitor context');
        expect(spyDebugLogs).toHaveBeenNthCalledWith(2, 'computeMurmurAlgorithm - murmur returned value="79"');
        expect(spyDebugLogs).toHaveBeenNthCalledWith(4, 'computeMurmurAlgorithm - murmur returned value="79"');
        expect(spyErrorLogs).toHaveBeenCalledTimes(0);
        expect(spyFatalLogs).toHaveBeenCalledTimes(0);
        expect(spyInfoLogs).toHaveBeenNthCalledWith(1, 'launch - 2 campaign(s) found matching current visitor');
        expect(spyWarnLogs).toHaveBeenCalledTimes(0);
        done();
    });
    it('should detect when bucket api response return panic mode', (done) => {
        bucketingApiMockResponse = demoData.bucketing.panic as BucketingApiResponse;
        bucketInstance = new Bucketing(demoData.envId[0], bucketingConfig, demoData.visitor.id[0], demoData.visitor.cleanContext);
        initSpyLogs(bucketInstance);
        bucketInstance.launch().then(spyThen).catch(spyCatch);
        mockAxios.mockResponse({ data: bucketingApiMockResponse, ...bucketingApiMockOterResponse });
        expect(mockAxios.get).toHaveBeenNthCalledWith(
            1,
            internalConfig.bucketingEndpoint.replace('@ENV_ID@', bucketInstance.envId),
            expectedRequestHeaderFirstCall
        );
        expect(spyThen).toHaveBeenCalledWith(bucketingApiMockResponse);
        expect(spyCatch).not.toHaveBeenCalled();

        expect(spyDebugLogs).toHaveBeenCalledTimes(0);
        expect(spyErrorLogs).toHaveBeenCalledTimes(0);
        expect(spyFatalLogs).toHaveBeenCalledTimes(0);
        expect(spyInfoLogs).toHaveBeenCalledTimes(0);
        expect(spyWarnLogs).toHaveBeenNthCalledWith(1, 'Panic mode detected, running SDK in safe mode...');
        done();
    });
    it('should log an error when bucketing api fail', (done) => {
        bucketInstance = new Bucketing(demoData.envId[0], bucketingConfig, demoData.visitor.id[0], demoData.visitor.cleanContext);
        initSpyLogs(bucketInstance);
        bucketInstance.launch().then(spyThen).catch(spyCatch);
        mockAxios.mockError('server crashed');
        expect(mockAxios.get).toHaveBeenNthCalledWith(
            1,
            internalConfig.bucketingEndpoint.replace('@ENV_ID@', bucketInstance.envId),
            expectedRequestHeaderFirstCall
        );
        expect(spyCatch).toHaveBeenCalled();
        expect(spyThen).not.toHaveBeenCalled();

        expect(spyDebugLogs).toHaveBeenCalledTimes(0);
        expect(spyErrorLogs).toHaveBeenCalledTimes(0);
        expect(spyFatalLogs).toHaveBeenNthCalledWith(1, 'An error occurred while fetching using bucketing...');
        expect(spyInfoLogs).toHaveBeenCalledTimes(0);
        expect(spyWarnLogs).toHaveBeenCalledTimes(0);
        done();
    });
});

describe('Bucketing initialization', () => {
    beforeEach(() => {
        spyCatch = jest.fn();
        spyThen = jest.fn();
    });
    afterEach(() => {
        sdk = null;
        bucketingApiMockResponse = null;
        visitorInstance = null;
        bucketInstance = null;

        mockAxios.reset();
    });
    it('should init the bucketing class when arguments are correct', (done) => {
        bucketInstance = new Bucketing(demoData.envId[0], bucketingConfig, demoData.visitor.id[0], demoData.visitor.cleanContext);
        expect(bucketInstance instanceof Bucketing).toEqual(true);

        expect(bucketInstance.envId).toEqual(demoData.envId[0]);
        expect(bucketInstance.data).toEqual(null);
        expect(bucketInstance.computedData).toEqual(null);
        expect(bucketInstance.log).toBeDefined();
        expect(bucketInstance.visitorId).toEqual(demoData.visitor.id[0]);
        expect(bucketInstance.visitorContext).toEqual(demoData.visitor.cleanContext);
        expect(bucketInstance.config).toEqual(bucketingConfig);
        done();
    });
});
