import { MongoClient } from 'mongodb';
declare let clientPromise: Promise<MongoClient>;
declare global {
    var _mongoClientPromise: Promise<MongoClient> | undefined;
}
export default clientPromise;
//# sourceMappingURL=mongodb.d.ts.map