import fs from 'fs';
import path from 'path';
import readline from 'readline';

const args = process.argv.slice(2);

const schemaFile = args.indexOf('--schema');
const outputFile = args.indexOf('--out');

if (schemaFile === -1) throw new Error('--schema file is required');
if (outputFile === -1) throw new Error('--out file path is required');

const apiSchemaFilePath = path.join(process.cwd(), args[schemaFile + 1]);

const fileReadString = fs.createReadStream(apiSchemaFilePath);
const fileReader = readline.createInterface(fileReadString);

let template =
	"import { getQuery, getInfiniteQuery, getLazyQuery, postMutation, putMutation, patchMutation, deleteMutation } from './api';\n\n";

let isParsingEnum = false;

fileReader.on('line', (line: string) => {
	if (line.startsWith('//')) return;

	const texts = line
		.trim()
		.split(' ')
		.filter((text) => !!text);

	const firstWord = texts[0];
	const startsAnObject = line.trim().endsWith('{');
	const isARequest = line.includes('(');

	const isKeyword = ['type', 'input', 'enum', 'get', 'post', 'put', 'delete', 'patch'].includes(firstWord);

	if ((isKeyword && startsAnObject) || (isKeyword && isARequest)) {
		if (firstWord === 'enum') {
			isParsingEnum = true;
			template += `export enum ${texts[1]} {\n`;
		}

		if (firstWord === 'type' || firstWord === 'input') {
			template += `export interface ${texts[1]} {\n`;
		}

		if (firstWord === 'get') {
			const [queryName, url, input] = getHookParams(texts.slice(1));
			const response = getSchemaTypescriptType(texts[3] ?? texts[2]);
			template += `export const Get${queryName}QueryKey = ${url};\nexport const get${queryName}Query = getQuery<${response}, ${
				input ?? 'unknown'
			}>(Get${queryName}QueryKey);\nexport const get${queryName}LazyQuery = getLazyQuery<${response}, ${
				input ?? 'unknown'
			}>(Get${queryName}QueryKey);\nexport const get${queryName}InfiniteQuery = getInfiniteQuery<${response}, ${
				input ?? 'unknown'
			}>(Get${queryName}QueryKey);\n\n`;
		}

		if (firstWord === 'post') {
			let [queryName, url, input] = getHookParams(texts.slice(1));
			const response = getSchemaTypescriptType(texts[3]);
			queryName = queryName.charAt(0).toLowerCase() + queryName.slice(1);
			template += `export const ${queryName}Mutation = postMutation<${response}, ${input}>(${url});\n\n`;
		}

		if (firstWord === 'put') {
			let [queryName, url, input] = getHookParams(texts.slice(1));
			const response = getSchemaTypescriptType(texts[3]);
			queryName = queryName.charAt(0).toLowerCase() + queryName.slice(1);
			template += `export const ${queryName}Mutation = putMutation<${response}, ${input}>(${url});\n\n`;
		}

		if (firstWord === 'delete') {
			let [queryName, url, input] = getHookParams(texts.slice(1));
			const response = getSchemaTypescriptType(texts[3]);
			queryName = queryName.charAt(0).toLowerCase() + queryName.slice(1);
			template += `export const ${queryName}Mutation = deleteMutation<${response}, ${input}>(${url});\n\n`;
		}

		if (firstWord === 'patch') {
			let [queryName, url, input] = getHookParams(texts.slice(1));
			const response = getSchemaTypescriptType(texts[3]);
			queryName = queryName.charAt(0).toLowerCase() + queryName.slice(1);
			template += `export const ${queryName}Mutation = patchMutation<${response}, ${input}>(${url});\n\n`;
		}
	} else {
		if ((texts.includes('=') || isParsingEnum) && firstWord !== '}') {
			template += `${firstWord.replace(/\./g, '_')} = "${firstWord}",\n`;
		}

		if (texts.includes('{')) {
			template += `${firstWord}: {\n`;
		}

		if (/\w+\s+(@?\w+!?)/.test(line.trim())) {
			const isOptionalField = texts.includes('@Optional');
			template += `${firstWord}${isOptionalField ? '?:' : ':'} ${formatSchemaValuesToTypescript(texts.slice(1))};\n`;
		}

		if (firstWord === '}') {
			template += '}\n';
			isParsingEnum = false;
		}
	}
});

function getHookParams(texts: string[]) {
	return texts.reduce((acc, text) => {
		const sanitizedText = text.replace(',', '').replace(':', '');
		let items: string[] = [];
		if (sanitizedText.includes('(')) {
			const [queryName, url] = sanitizedText.split('(');
			items = items.concat([queryName, url.replace(')', '')]);
			return acc.concat(items);
		}
		if (sanitizedText.includes(')')) items = items.concat(sanitizedText.replace(')', ''));
		return acc.concat(items);
	}, [] as string[]);
}

function formatSchemaValuesToTypescript(remainingTexts: string[]) {
	if (!Array.isArray(remainingTexts)) throw new Error('Schema values is incorrect');
	let typescriptTemplate = '';

	remainingTexts.forEach((text) => {
		if (typeof text !== 'string') return;
		const template = getSchemaTypescriptType(text);
		if (!template) return;
		typescriptTemplate += template;
	});

	return typescriptTemplate;
}

function getSchemaTypescriptType(text: string) {
	const isOptional = text.includes('!');

	if (text.includes('@')) {
		const isArray = text.includes('[]');

		if (text.includes('Int')) {
			return isOptional ? `Maybe<number${isArray ? '[]' : ''}>` : `number${isArray ? '[]' : ''}`;
		}

		if (text.includes('Float')) {
			return isOptional ? `Maybe<number${isArray ? '[]' : ''}>` : `number${isArray ? '[]' : ''}`;
		}

		if (text.includes('String')) {
			return isOptional ? `Maybe<string${isArray ? '[]' : ''}>` : `string${isArray ? '[]' : ''}`;
		}

		if (text.includes('Boolean')) {
			return isOptional ? `Maybe<boolean${isArray ? '[]' : ''}>` : `boolean${isArray ? '[]' : ''}`;
		}

		if (text.includes('Object')) {
			return isOptional
				? `Maybe<Record<string, any>${isArray ? '[]' : ''}>`
				: `Record<string, any>${isArray ? '[]' : ''}`;
		}

		if (text.includes('Date')) {
			return isOptional
				? `Maybe<(Date | string)${isArray ? '[]' : ''}>`
				: `${isArray ? '(Date | string)[]' : 'Date | string'}`;
		}
	}

	if (text === '|') return ' | ';

	if (!text.includes('@')) {
		const sanitizedText = text.replace('!', '');
		return isOptional ? `Maybe<${sanitizedText}>` : sanitizedText;
	}
}

fileReader.on('close', () => {
	const generatedCodeFilePath = path.join(process.cwd(), args[outputFile + 1]);
	const fileExists = fs.existsSync(generatedCodeFilePath);
	if (fileExists) fs.writeFileSync(generatedCodeFilePath, template);
	else fs.appendFileSync(generatedCodeFilePath, template);
});
