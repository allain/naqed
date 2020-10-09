import { Scalar } from './scalars'

type RequestIter<T> = Record<
  string,
  number | string | boolean | Scalar | number[] | string[] | T
>
export interface Request extends RequestIter<Request> {}
