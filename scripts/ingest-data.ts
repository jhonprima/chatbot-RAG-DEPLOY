import 'dotenv/config';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { CohereEmbeddings } from "@langchain/cohere";
import { PineconeStore } from "@langchain/pinecone";
import { pinecone } from '@/utils/pinecone-client';
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { PINECONE_INDEX_NAME, PINECONE_NAME_SPACE, COHERE_API_KEY } from '@/config/pinecone';
import { DirectoryLoader } from 'langchain/document_loaders/fs/directory';

const filePath = 'docs';
const indexName = process.env.NEW_INDEX_NAME || PINECONE_INDEX_NAME;

export const run = async () => {
  try {
    const directoryLoader = new DirectoryLoader(filePath, {
      '.pdf': (path) => new PDFLoader(path),
    });

    const rawDocs = await directoryLoader.load();

    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });

    const docs = await textSplitter.splitDocuments(rawDocs);
    console.log(`✅ Split ${docs.length} documents`);

    const embeddings = new CohereEmbeddings({
      model: "embed-english-v3.0",
      apiKey: COHERE_API_KEY,
      batchSize: 48,
    });

    const index = pinecone.Index(indexName);

    const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
      pineconeIndex: index,
      namespace: PINECONE_NAME_SPACE,
      textKey: 'text',
    });

    await vectorStore.addDocuments(docs);

    console.log('✅ Ingestion complete');
  } catch (error) {
    console.error('❌ Error during ingestion:', error);
    throw new Error('Failed to ingest your data');
  }
};

(async () => {
  await run();
})();
