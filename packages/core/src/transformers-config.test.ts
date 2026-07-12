import { describe, expect, it } from 'vitest';
import {
  hasLocalModelSources,
  resolveOnnxSubfolder,
  resolveTransformersModelRef,
} from '../src/worker/transformers-config';
import type { ModelBundleManifest, ModelSourceConfig } from '../src/types';

function source(
  baseUrl: string,
  manifest: Partial<ModelBundleManifest> & Pick<ModelBundleManifest, 'engine'>,
  localOnly?: boolean,
): ModelSourceConfig {
  return {
    baseUrl,
    localOnly,
    engine: manifest.engine,
    manifest: {
      version: '1',
      files: manifest.files ?? [],
      engine: manifest.engine,
      hfModelId: manifest.hfModelId,
    },
  };
}

describe('resolveTransformersModelRef', () => {
  it('uses Hugging Face model ids for registry sources', () => {
    const ref = resolveTransformersModelRef(
      source('https://huggingface.co/example/model/', { engine: 'transformers', hfModelId: 'org/model' }),
      'fallback/model',
    );
    expect(ref).toEqual({ path: 'org/model', localOnly: false });
  });

  it('uses baseUrl for self-hosted sources', () => {
    const ref = resolveTransformersModelRef(
      source('/localizer-models/micro/', { engine: 'transformers', files: ['model.onnx'] }, true),
      'fallback/model',
    );
    expect(ref).toEqual({ path: '/localizer-models/micro', localOnly: true, subfolder: '' });
  });
});

describe('resolveOnnxSubfolder', () => {
  it('detects onnx subdirectories from manifest files', () => {
    expect(resolveOnnxSubfolder({
      version: '1',
      engine: 'transformers',
      files: ['onnx/model.onnx', 'tokenizer.json'],
    })).toBe('onnx');
  });

  it('uses root directory when model.onnx is top-level', () => {
    expect(resolveOnnxSubfolder({
      version: '1',
      engine: 'transformers',
      files: ['model.onnx', 'tokenizer.json'],
    })).toBe('');
  });
});

describe('hasLocalModelSources', () => {
  it('returns true when any bundle is marked localOnly', () => {
    const result = hasLocalModelSources({
      micro: source('/localizer-models/micro/', { engine: 'transformers' }, true),
      standard: source('https://huggingface.co/example/', { engine: 'webllm' }),
      premium: source('https://huggingface.co/example/', { engine: 'webllm' }),
      nlp: {
        summarize: source('https://huggingface.co/example/', { engine: 'transformers' }),
      },
    });
    expect(result).toBe(true);
  });
});
