import mockAxios from 'jest-mock-axios';
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
let bucketingApiMockResponse: BucketingApiResponse;
const bucketingConfig: FlagshipSdkConfig = {
    ...testConfig,
    fetchNow: true,
    decisionMode: 'Bucketing'
};

describe('Bucketing', () => {
    beforeEach(() => {
        //     spyWarnLogs = jest.spyOn(visitorInstance.log, 'warn');
        //     spyErrorLogs = jest.spyOn(visitorInstance.log, 'error');
        //     spyFatalLogs = jest.spyOn(visitorInstance.log, 'fatal');
        //     spyInfoLogs  = jest.spyOn(visitorInstance.log, 'info');
        //     spyDebugLogs = jest.spyOn(visitorInstance.log, 'debug');
    });
    afterEach(() => {
        sdk = null;
        bucketingApiMockResponse = null;
        visitorInstance = null;
        bucketInstance = null;
        mockAxios.reset();
    });
    it('should trigger bucketing behavior when creating new visitor with config having "bucketing" in decision mode', (done) => {
        bucketingApiMockResponse = demoData.bucketing.classical as BucketingApiResponse;
        sdk = flagshipSdk.initSdk(demoData.envId[0], bucketingConfig);
        visitorInstance = sdk.newVisitor(demoData.visitor.id[0], demoData.visitor.cleanContext);
        expect(visitorInstance.bucket instanceof Bucketing).toEqual(true);
        mockAxios.mockResponse({ data: bucketingApiMockResponse });
        expect(mockAxios.get).toHaveBeenNthCalledWith(1, internalConfig.bucketingEndpoint.replace('@ENV_ID@', visitorInstance.envId));
        expect(visitorInstance.fetchedModifications).toEqual(true);
        done();
    });
});