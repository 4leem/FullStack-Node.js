import util from 'util';
import { constants } from '../utils/constants';

class Exception {
    printStackTrace(err) {
        Object.keys(err).forEach(ele => {
            util.debuglog(err[ele]);
        });
        return {
            status: constants.ERROR,
            message: err.errmsg || err.msg
        };
    }
}

export default Exception;
