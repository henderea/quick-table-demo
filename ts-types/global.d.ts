declare type Optional<T> = T | null | undefined
declare type List<T> = ArrayLike<T>;
declare type Many<T> = T | ReadonlyArray<T>;

declare interface Dictionary<T> {
  [index: string]: T;
}

declare var process: {
  env: {
    NODE_ENV: 'development' | 'production',
    VERCEL_URL: Optional<string>;
  }
};